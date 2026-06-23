import type {
  AnnotationIssue,
  ContentIssue,
  CourseDTO,
  CourseListSort,
  CourseMode,
  CreateCourseInput,
  CreateSessionInput,
  ModeIssue,
  SessionDTO,
  UpdateCourseInput,
} from '@echotype/shared';

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(0, null, 'Network error. Check your connection and try again.');
  }

  if (!res.ok) {
    const body = await parseErrorBody(res);
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) {
    const text = await res.text();
    // CloudFront custom_error_response maps origin 404 → 200 + index.html for SPA.
    if (looksLikeHtmlDocument(text)) {
      throw new ApiError(410, { error: 'not_found' });
    }
    throw new ApiError(res.status, { message: text }, 'Unexpected response format');
  }
  return res.json() as Promise<T>;
}

export const api = {
  listCourses: (mode?: CourseMode, opts?: { q?: string; sort?: CourseListSort }) => {
    const params = new URLSearchParams();
    if (mode) params.set('mode', mode);
    if (opts?.q) params.set('q', opts.q);
    if (opts?.sort) params.set('sort', opts.sort);
    const qs = params.toString();
    return request<CourseDTO[]>(`/courses${qs ? `?${qs}` : ''}`);
  },
  getCourse: (id: string) => request<CourseDTO>(`/courses/${id}`),
  createCourse: (input: CreateCourseInput) =>
    request<CourseDTO>('/courses', { method: 'POST', body: JSON.stringify(input) }),
  updateCourse: (id: string, input: UpdateCourseInput) =>
    request<CourseDTO>(`/courses/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteCourse: (id: string) => request<void>(`/courses/${id}`, { method: 'DELETE' }),
  createSession: (input: CreateSessionInput) =>
    request<SessionDTO>('/sessions', { method: 'POST', body: JSON.stringify(input) }),
  listSessions: (courseId?: string) =>
    request<SessionDTO[]>(`/sessions${courseId ? `?courseId=${courseId}` : ''}`),
};
