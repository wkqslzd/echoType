import type { AccountDTO, FederatedLinkResult } from '@echotype/shared';
import type {
  AnnotationIssue,
  ContentIssue,
  CourseDTO,
  CourseListSort,
  CourseMode,
  CategoryDTO,
  CreateCategoryInput,
  CreateCourseInput,
  CreateSessionInput,
  CreateSessionResponse,
  ModeIssue,
  SessionDTO,
  UpdateCategoryInput,
  UpdateCourseInput,
} from '@echotype/shared';
import {
  clearAuthSession,
  forceRefreshAccessToken,
  getValidAccessToken,
  loadAuthSession,
} from '../auth/authSession.js';
import { loginPathWithNext } from '../auth/publicPaths.js';

const BASE = '/api';

export type CourseApiErrorCode =
  | 'annotation_validation_error'
  | 'content_validation_error'
  | 'mode_length_violation'
  | string;

export type CourseApiErrorBody = {
  error: CourseApiErrorCode;
  issues?: Array<AnnotationIssue | ContentIssue | ModeIssue>;
};

/** Structured API failure so the editor can branch on status + error code. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `API ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }

  get courseBody(): CourseApiErrorBody | null {
    if (this.body && typeof this.body === 'object' && 'error' in this.body) {
      return this.body as CourseApiErrorBody;
    }
    return null;
  }
}

export function getApiErrorStatus(error: unknown): number | null {
  if (error instanceof ApiError) return error.status;
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return null;
}

/** Missing/deleted course — 410 avoids CloudFront SPA 404→index.html rewrite on /api. */
export function isCourseNotFoundError(error: unknown): boolean {
  const status = getApiErrorStatus(error);
  return status === 404 || status === 410;
}

function looksLikeHtmlDocument(text: string): boolean {
  return /^\s*</.test(text) || /<!DOCTYPE/i.test(text);
}

async function parseErrorBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function redirectToLogin(): void {
  // Guest browse: no session — surface 401 to callers without forcing /login.
  if (!loadAuthSession()) return;
  const next = window.location.pathname + window.location.search;
  clearAuthSession();
  window.location.assign(loginPathWithNext(next));
}

async function fetchWithAuth(
  path: string,
  init: RequestInit | undefined,
  token: string | null,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  try {
    return await fetch(BASE + path, { ...init, headers });
  } catch {
    throw new ApiError(0, null, 'Network error. Check your connection and try again.');
  }
}

/** OAuth callback: link with fresh tokens only; no session persist or login redirect on 401. */
export async function postFederatedLink(
  accessToken: string,
  idToken: string,
): Promise<FederatedLinkResult> {
  const res = await fetchWithAuth(
    '/auth/federated/link',
    {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    },
    accessToken,
  );
  if (!res.ok) {
    const body = await parseErrorBody(res);
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<FederatedLinkResult>;
}

export type EmailStatusResult =
  | { available: true }
  | { available: false; message: string };

/** Public: whether email can be used for native SignUp (no auth). */
export async function checkEmailStatus(email: string): Promise<EmailStatusResult> {
  const res = await fetchWithAuth(
    '/auth/email-status',
    {
      method: 'POST',
      body: JSON.stringify({ email: email.trim() }),
    },
    null,
  );
  if (!res.ok) {
    const body = await parseErrorBody(res);
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<EmailStatusResult>;
}

async function request<T>(path: string, init?: RequestInit, authRetried = false): Promise<T> {
  let token = await getValidAccessToken();
  let res = await fetchWithAuth(path, init, token);

  if (res.status === 401 && !authRetried) {
    token = await forceRefreshAccessToken();
    if (token) {
      res = await fetchWithAuth(path, init, token);
    }
  }

  if (res.status === 401) {
    redirectToLogin();
    throw new ApiError(401, { error: 'unauthorized' });
  }

  if (!res.ok) {
    const body = await parseErrorBody(res);
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) {
    const text = await res.text();
    if (looksLikeHtmlDocument(text)) {
      throw new ApiError(410, { error: 'not_found' });
    }
    throw new ApiError(res.status, { message: text }, 'Unexpected response format');
  }
  return res.json() as Promise<T>;
}

export const api = {
  listCourses: (
    mode?: CourseMode,
    opts?: { q?: string; sort?: CourseListSort; categoryId?: string | 'null' },
  ) => {
    const params = new URLSearchParams();
    if (mode) params.set('mode', mode);
    if (opts?.q) params.set('q', opts.q);
    if (opts?.sort) params.set('sort', opts.sort);
    if (opts?.categoryId !== undefined) params.set('categoryId', opts.categoryId);
    const qs = params.toString();
    return request<CourseDTO[]>(`/courses${qs ? `?${qs}` : ''}`);
  },
  checkCourseTitleAvailable: (
    mode: CourseMode,
    title: string,
    excludeId?: string,
  ) => {
    const params = new URLSearchParams({ mode, title });
    if (excludeId) params.set('excludeId', excludeId);
    return request<{ available: boolean }>(`/courses/title-available?${params.toString()}`);
  },
  patchCoursesCategory: (courseIds: string[], categoryId: string | null) =>
    request<{ updated: number }>('/courses/category', {
      method: 'PATCH',
      body: JSON.stringify({ courseIds, categoryId }),
    }),
  listCategories: (mode?: CourseMode, opts?: { q?: string; sort?: CourseListSort }) => {
    const params = new URLSearchParams();
    if (mode) params.set('mode', mode);
    if (opts?.q) params.set('q', opts.q);
    if (opts?.sort) params.set('sort', opts.sort);
    const qs = params.toString();
    return request<CategoryDTO[]>(`/categories${qs ? `?${qs}` : ''}`);
  },
  getCategory: (id: string) => request<CategoryDTO>(`/categories/${id}`),
  createCategory: (input: CreateCategoryInput) =>
    request<CategoryDTO>('/categories', { method: 'POST', body: JSON.stringify(input) }),
  updateCategory: (id: string, input: UpdateCategoryInput) =>
    request<CategoryDTO>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteCategory: (id: string) => request<void>(`/categories/${id}`, { method: 'DELETE' }),
  getCourse: (id: string) => request<CourseDTO>(`/courses/${id}`),
  createCourse: (input: CreateCourseInput) =>
    request<CourseDTO>('/courses', { method: 'POST', body: JSON.stringify(input) }),
  updateCourse: (id: string, input: UpdateCourseInput) =>
    request<CourseDTO>(`/courses/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteCourse: (id: string) => request<void>(`/courses/${id}`, { method: 'DELETE' }),
  createSession: (input: CreateSessionInput) =>
    request<CreateSessionResponse>('/sessions', { method: 'POST', body: JSON.stringify(input) }),
  listSessions: (courseId?: string) =>
    request<SessionDTO[]>(`/sessions${courseId ? `?courseId=${courseId}` : ''}`),
  getAccount: () => request<AccountDTO>('/account'),
  updateAccount: (input: { name: string }) =>
    request<AccountDTO>('/account', { method: 'PUT', body: JSON.stringify(input) }),
  deleteAccount: (opts?: { adminCognitoDelete?: boolean; idToken?: string }) =>
    request<void>('/account', {
      method: 'DELETE',
      body: JSON.stringify(opts ?? {}),
    }),
  linkFederated: (idToken: string) =>
    request<FederatedLinkResult>('/auth/federated/link', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    }),
  checkEmailStatus: (email: string) => checkEmailStatus(email),
  seedOnboarding: () => request<void>('/onboarding/seed', { method: 'POST' }),
};
