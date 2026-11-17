import React from 'react';
import { afterEach, Mock } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useRouter } from 'next/router';
import type { AppProps } from 'next/app';
import App from '../../pages/_app';
import client from '../../src/api/client';
import User from '../../src/classes/User';
import { translate } from '../../src/i18n';
import { formatMoneyDisplay } from '../../src/support/utils';

// A fake API behind the app's axios client: routes are 'GET car/3' → a handler returning the
// resource or list (wrapped in `{ data }` as the API does) or a `reply()` for anything else.
export interface Request { method: string, url: string, params: Record<string, any>, data: any }
type Handler = (request: Request) => unknown;
class Reply {
  constructor(public status: number, public body: unknown) {}
}
export const reply = (status: number, body: unknown = {}) => new Reply(status, body);
export const invalid = (errors: Record<string, string[]>) => reply(422, { message: 'invalid', errors });
// The API can't be reached.
export const OFFLINE = Symbol('offline');

let routes: Record<string, Handler> = {};
export let requests: Request[] = [];
export let unhandled: string[] = [];

export function serve(more: Record<string, unknown>) {
  for (const [ route, value ] of Object.entries(more)) {
    routes[route] = typeof value === 'function' ? value as Handler : () => value;
  }
}

// The requests a page sent to a route ('POST contract'), in order.
export const sent = (route: string) =>
  requests.filter(request => request.method + ' ' + request.url === route);

client.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
  const request: Request = {
    method: config.method!.toUpperCase(),
    url: config.url!,
    params: Object.fromEntries(Object.entries(config.params ?? {}).filter(([ , value ]) => value !== undefined)),
    data: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
  };
  requests.push(request);
  const route = request.method + ' ' + request.url;
  const handler = routes[route];
  if (! handler) {
    unhandled.push(route);
  }
  const result = handler ? handler(request) : reply(404);
  if (result === OFFLINE) {
    throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
  }
  const { status, body } = result instanceof Reply ? result : { status: 200, body: Array.isArray(result) ?
    { data: result, total: result.length, lastPage: 1, currentPage: 1 } : { data: result } };
  const response = { status, statusText: String(status), data: body, headers: {}, config };
  if (status >= 400) {
    throw new AxiosError('Request failed with status code ' + status, AxiosError.ERR_BAD_REQUEST, config, null, response);
  }
  return response;
};

// The mocked router of test/setup.ts: where a page navigated is in its mocks.
const router = useRouter() as unknown as { pathname: string, asPath: string, query: Record<string, string>, push: Mock, replace: Mock, back: Mock };
let queryClient: QueryClient|undefined;

afterEach(() => {
  queryClient?.clear();
  routes = {};
  requests = [];
  unhandled = [];
});

// Signed in as this user on the next render (the app restores the session with `refresh`).
export function signIn(user: User) {
  localStorage.setItem('user_access_token', 'saved');
  serve({ 'POST refresh': { ...user, access_token: 'fresh' } });
}

// Renders a page inside the real `_app` (session, guard, layout, theme), as Next would at this
// URL: `pathname` is the file's route ('/cars/[id]'), `asPath` the URL ('/cars/3').
export function renderPage(Page: React.ComponentType<any>, pathname: string, asPath = pathname) {
  if (! localStorage.getItem('lang')) {
    localStorage.setItem('lang', 'en'); // readable assertions; the app's default is Tunisian
  }
  const url = new URL(asPath, 'http://localhost');
  const dynamic = pathname.match(/\[(\w+)\]/g)?.map(segment => segment.slice(1, -1)) ?? [];
  const values = url.pathname.split('/').filter((_, index) => pathname.split('/')[index]?.startsWith('['));
  Object.assign(router, {
    pathname,
    asPath,
    query: { ...Object.fromEntries(url.searchParams), ...Object.fromEntries(dynamic.map((name, index) => [ name, values[index] ])) },
  });
  function Captured(props: object) {
    queryClient = useQueryClient();
    return <Page {...props} />;
  }
  return render(<App Component={Captured} pageProps={{}} router={router as unknown as AppProps['router']} />);
}

// Typing and clicking wait for the field or button to show (the session restores first).
export async function type(label: string, value: string) {
  // Through the <label> (a required one ends with ' *'): findByLabelText walks every element of the
  // page, seconds per field on a long MUI form.
  const field = await waitFor(() => {
    const control = [ ...document.querySelectorAll('label') ].find(element => element.textContent!.replace(/\s*\*$/, '') === label)?.control;
    if (! control) {
      throw new Error('No field labelled ' + label);
    }
    return control;
  });
  fireEvent.change(field, { target: { value } });
}
export async function click(name: string, index = 0) {
  fireEvent.click((await screen.findAllByText(name, { selector: 'button' }))[index]); // role queries are slow
}

// The English text the page shows for a key.
export const t = (key: string, params: Record<string, any> = {}) => translate(key, 'en', params);

// Thousands are grouped by a narrow no-break space, which Testing Library reads in the page as a plain space.
export const money = (millimes: number) => formatMoneyDisplay(millimes, 'en').replace(/\s/g, ' ');

export { router, screen };
