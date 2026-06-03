import type {
  CourseDTO,
  CreateCourseInput,
  UpdateCourseInput,
  CreateSessionInput,
  SessionDTO,
} from '@echotype/shared';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listCourses: () => request<CourseDTO[]>('/courses'),
  getCourse: (id: string) => request<CourseDTO>(`/courses/${id}`),
  createCourse: (input: CreateCourseInput) =>
    request<CourseDTO>('/courses', { method: 'POST', body: JSON.stringify(input) }),
  updateCourse: (id: string, input: UpdateCourseInput) =>
    request<CourseDTO>(`/courses/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  createSession: (input: CreateSessionInput) =>
    request<SessionDTO>('/sessions', { method: 'POST', body: JSON.stringify(input) }),
  listSessions: (courseId?: string) =>
    request<SessionDTO[]>(`/sessions${courseId ? `?courseId=${courseId}` : ''}`),
};
