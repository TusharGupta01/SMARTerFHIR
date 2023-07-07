import * as R4 from "fhir/r4";
import SubClient, { FhirClientTypes } from "./FhirClient";

/**
Represents the PartiallyRequired type, which makes specified properties required and the rest optional.
@typedef {Omit<Partial<T>, K> & Required<Pick<Partial<T>, K>>} PartiallyRequired<T, K>
@template T - The original type.
@template K - The keys to make required.
*/
export type PartiallyRequired<T, K extends keyof T> = Omit<Partial<T>, K> &
  Required<Pick<Partial<T>, K>>;

/**
 * Represents the R4ResourceWithRequiredType type, which is a resource with required resource type.
 * @typedef {PartiallyRequired<R4.Resource, "resourceType">} R4ResourceWithRequiredType
 */
export type R4ResourceWithRequiredType = PartiallyRequired<
  R4.Resource,
  "resourceType"
>;

/**
 * Represents the FhirClientResourceWithRequiredType type, which is a FHIR client resource with required resource type.
 * @typedef {PartiallyRequired<FhirClientTypes.FHIR.Resource, "resourceType">} FhirClientResourceWithRequiredType
 */
export type FhirClientResourceWithRequiredType = PartiallyRequired<
  FhirClientTypes.FHIR.Resource,
  "resourceType"
>;

/**
 * Represents the ObjectWithID type, which can be either a patient or an encounter from the FHIR client.
 */
export type ObjectWithID = SubClient["patient" | "encounter" | "user"];

/**
 * Represents the Subject type, which is an object with a subject reference.
 */
export type GenericSubject = { subject: R4.Reference };

/**
 * Represents the Encounter type, which is an object with an array of encounter references.
 */
export type GenericEncounter = { encounter: R4.Reference[] };

/**
 * Represents the Context type, which is an object with a context containing encounter references.
 */
export type GenericContext = R4.DocumentReference["context"];

export type Author = { author: R4.Reference[] };
