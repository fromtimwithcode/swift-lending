/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as borrower from "../borrower.js";
import type * as comps from "../comps.js";
import type * as documents from "../documents.js";
import type * as draws from "../draws.js";
import type * as email from "../email.js";
import type * as http from "../http.js";
import type * as investor from "../investor.js";
import type * as lib_auth from "../lib/auth.js";
import type * as loanPayments from "../loanPayments.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  borrower: typeof borrower;
  comps: typeof comps;
  documents: typeof documents;
  draws: typeof draws;
  email: typeof email;
  http: typeof http;
  investor: typeof investor;
  "lib/auth": typeof lib_auth;
  loanPayments: typeof loanPayments;
  messages: typeof messages;
  notifications: typeof notifications;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
