/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activityLog from "../activityLog.js";
import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as borrower from "../borrower.js";
import type * as borrowerPrivate from "../borrowerPrivate.js";
import type * as borrowerPrivateActions from "../borrowerPrivateActions.js";
import type * as calculationGuide from "../calculationGuide.js";
import type * as comps from "../comps.js";
import type * as crons from "../crons.js";
import type * as documents from "../documents.js";
import type * as draws from "../draws.js";
import type * as email from "../email.js";
import type * as http from "../http.js";
import type * as investor from "../investor.js";
import type * as lib_appConfiguration from "../lib/appConfiguration.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_borrowerPrivateValidation from "../lib/borrowerPrivateValidation.js";
import type * as lib_calculationGuide from "../lib/calculationGuide.js";
import type * as lib_comparableRules from "../lib/comparableRules.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_drawDates from "../lib/drawDates.js";
import type * as lib_financialRules from "../lib/financialRules.js";
import type * as lib_loanCalculations from "../lib/loanCalculations.js";
import type * as lib_notifications from "../lib/notifications.js";
import type * as lib_propertyDetails from "../lib/propertyDetails.js";
import type * as lib_propertyValidators from "../lib/propertyValidators.js";
import type * as lib_sensitiveData from "../lib/sensitiveData.js";
import type * as lib_settings from "../lib/settings.js";
import type * as loanCharges from "../loanCharges.js";
import type * as loanPayments from "../loanPayments.js";
import type * as messages from "../messages.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as settings from "../settings.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activityLog: typeof activityLog;
  admin: typeof admin;
  auth: typeof auth;
  borrower: typeof borrower;
  borrowerPrivate: typeof borrowerPrivate;
  borrowerPrivateActions: typeof borrowerPrivateActions;
  calculationGuide: typeof calculationGuide;
  comps: typeof comps;
  crons: typeof crons;
  documents: typeof documents;
  draws: typeof draws;
  email: typeof email;
  http: typeof http;
  investor: typeof investor;
  "lib/appConfiguration": typeof lib_appConfiguration;
  "lib/auth": typeof lib_auth;
  "lib/borrowerPrivateValidation": typeof lib_borrowerPrivateValidation;
  "lib/calculationGuide": typeof lib_calculationGuide;
  "lib/comparableRules": typeof lib_comparableRules;
  "lib/constants": typeof lib_constants;
  "lib/dates": typeof lib_dates;
  "lib/drawDates": typeof lib_drawDates;
  "lib/financialRules": typeof lib_financialRules;
  "lib/loanCalculations": typeof lib_loanCalculations;
  "lib/notifications": typeof lib_notifications;
  "lib/propertyDetails": typeof lib_propertyDetails;
  "lib/propertyValidators": typeof lib_propertyValidators;
  "lib/sensitiveData": typeof lib_sensitiveData;
  "lib/settings": typeof lib_settings;
  loanCharges: typeof loanCharges;
  loanPayments: typeof loanPayments;
  messages: typeof messages;
  migrations: typeof migrations;
  notifications: typeof notifications;
  settings: typeof settings;
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
