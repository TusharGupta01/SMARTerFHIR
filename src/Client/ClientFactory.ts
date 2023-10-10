import * as FHIR from "fhirclient"
import jwt_decode, { InvalidTokenError } from "jwt-decode"
import SubClient, { FhirClientTypes } from "../FhirClient"
import { EMR, instanceOfEmr } from "../Launcher/SmartLaunchHandler"
import BaseClient, { EMR_ENDPOINTS } from "./BaseClient"
import CernerClient from "./CernerClient"
import EpicClient from "./EpicClient"

export enum LAUNCH {
	EMR,
	STANDALONE,
	BACKEND
}

/**
 * The type represents a JSON Web Token (JWT) with properties for client_id and an optional epic.eci property.
 * @property {string} client_id - A string representing the client ID.
 * @property {string}  - - `client_id`: A string representing the client ID associated with the JWT.
 */
type JWT = {
	client_id: string
	"epic.eci"?: string
}

/**
 * The function checks if an object is an instance of the JWT class by verifying if it has a client_id property.
 * @param {unknown} object - The `object` parameter is of type `unknown`, which means it can be any type.
 * @returns a boolean value.
 */
function instanceOfJWT(object: unknown): object is JWT {
	return (object as JWT).client_id !== undefined
}


/**
Represents the ClientFactory class for creating EMR clients.
*/
export default class ClientFactory {

	/**
 * The function `getEMRType` determines the type of Electronic Medical Record (EMR) based on the provided client or token.
 * @param {SubClient | JWT} clientOrToken - The parameter `clientOrToken` can be either a `SubClient` object or a JWT (JSON Web Token).
 * @returns the type of Electronic Medical Record (EMR) based on the input parameter. The possible return values are EMR.CERNER, EMR.SMART, EMR.EPIC, or EMR.NONE.
 */
	private getEMRType(clientOrToken: SubClient | JWT): EMR {
		if (clientOrToken instanceof SubClient) {
			if (clientOrToken.state.serverUrl.includes("cerner")) {
				return EMR.CERNER
			}
			if (clientOrToken.state.serverUrl.includes("smarthealthit")) {
				return EMR.SMART
			}
			if (clientOrToken.state.serverUrl.includes("epic")) {
				return EMR.EPIC
			}
			return EMR.NONE
		} else {
			if ("epic.eci" in clientOrToken) {
				return EMR.EPIC
			}
			return EMR.NONE
		}
	}


	/**
	 * The function `createEMRClient` creates an EMR client based on the specified launch type.
	 * @param {LAUNCH} launchType - The `launchType` parameter is an optional parameter of type `LAUNCH` that specifies the type of EMR launch. It has a default value
	 * of `LAUNCH.EMR`.
	 * @returns a Promise that resolves to an instance of the `BaseClient` class.
	 */
	async createEMRClient(launchType: LAUNCH = LAUNCH.EMR): Promise<BaseClient> {
		const defaultFhirClient = await this.createDefaultFhirClient(launchType)
		const emrType = this.getEMRType(defaultFhirClient)
		switch (emrType) {
			case EMR.EPIC:
				return new EpicClient(defaultFhirClient)
			case EMR.CERNER:
				return new CernerClient(defaultFhirClient)
			case EMR.SMART:
			case EMR.NONE:
			default:
				throw new Error("Unsupported provider for EMR Client creation")
		}
	}

	/**
	 * The function creates a default FHIR client based on the launch type.
	 * @param {LAUNCH} launchType - The `launchType` parameter is an enum type called `LAUNCH`. It represents the type of launch for the FHIR client. There are two
	 * possible values for `LAUNCH`:
	 * @returns a Promise that resolves to a SubClient object.
	 */
	private async createDefaultFhirClient(launchType: LAUNCH): Promise<SubClient> {
		switch (launchType) {
			case LAUNCH.EMR:
			case LAUNCH.STANDALONE:
				return FHIR.oauth2.ready()
				// return this.buildStandaloneFhirClient()
			default:
				throw new Error("Unsupported provider for standalone launch")
		}
	}

	/**
	 * The function `getEmrEndpoints` returns the endpoints based on the EMR type obtained from the JWT.
	 * @param {JWT} jwt - The "jwt" parameter is a JSON Web Token (JWT) that is used for authentication and authorization purposes. It contains information about the
	 * user and their permissions.
	 * @returns an object of type EMR_ENDPOINTS.
	 */
	private getEmrEndpoints(emrType: EMR): EMR_ENDPOINTS;
	private getEmrEndpoints(jwt: JWT): EMR_ENDPOINTS;
	private getEmrEndpoints(object: unknown): EMR_ENDPOINTS {
		switch (this.getEmrTypeFromObject(object)) {
			case EMR.EPIC:
				return EpicClient.getEndpoints()
			case EMR.CERNER:
				return CernerClient.getEndpoints()
			case EMR.SMART:
			case EMR.NONE:
			default:
				throw new Error('EMR type not defined.')
		}
	}


/**
 * The function `getEmrTypeFromObject` takes an object as input and returns the corresponding EMR type if the object is of type JWT or EMR, otherwise it throws an
 * error.
 * @param {unknown} object - The `object` parameter is of type `unknown`, which means it can be any type. It is used as input to determine the EMR (Electronic
 * Medical Record) type. The function checks if the `object` is an instance of JWT (JSON Web Token) or EMR, and returns
 * @returns an EMR (Electronic Medical Record) object.
 */
	private getEmrTypeFromObject(object: unknown): EMR {
		if (instanceOfJWT(object)) return this.getEMRType(object)
		if (instanceOfEmr(object)) return (object as EMR)
		throw new Error('Invalid object type.')
	}

	/* The `buildStandaloneFhirClient` function is responsible for creating a standalone FHIR client. */
	private async buildStandaloneFhirClient() {
		const code = getCodeFromBrowserUrl()
		const { endpoints, clientId }: { endpoints: EMR_ENDPOINTS; clientId: string } = this.getRequiredTokenParameters(code)
		const redirectUri = window.location.origin + window.location.pathname // The current URL minus any parameters
		const tokenResponse = await getAccessToken(endpoints.token, code, clientId, redirectUri)
		const defaultFhirClient = FHIR.client(endpoints.r4.toString())
		defaultFhirClient.state.clientId = clientId
		defaultFhirClient.state.tokenUri = endpoints.token.toString()
		defaultFhirClient.state.tokenResponse = {
			...tokenResponse
		}
		return defaultFhirClient
	}

/* The `getRequiredTokenParameters` function is responsible for retrieving the required token parameters based on the provided code. */
	private getRequiredTokenParameters(code: string) {
		try {
			const decodedJwt: JWT = codeToJwt(code)
			return { endpoints: this.getEmrEndpoints(decodedJwt), clientId: decodedJwt.client_id }
		} catch (reason) {
			const clientIdFromEnv = process.env.REACT_APP_EMR_CLIENT_ID
			const emrType = ((process.env.REACT_APP_EMR_TYPE as string).toLowerCase() as EMR)
			const isRequiredParamsGiven = emrType && clientIdFromEnv
			if (!isRequiredParamsGiven) {
				if (reason instanceof InvalidTokenError)
					throw new InvalidTokenError('Cannot decode the Code for the EMR type. You must provide the client_id and emr_type explicitly')
				throw reason
			} else {
				if (!emrType) throw new Error('EMR type cannot be inferred. You must provide the emr_type explicitly')
				return { endpoints: this.getEmrEndpoints(emrType), clientId: clientIdFromEnv }
			}
		}
	}
}

/**
 * The function `getAccessToken` is an async function that makes a POST request to a token endpoint with the provided code and client ID, and returns the access
 * token from the response.
 * @param {URL} tokenEndpoint - The `tokenEndpoint` parameter is the URL of the token endpoint where you need to send the authorization code to obtain an access
 * token. This endpoint is typically provided by the OAuth server or authorization server.
 * @param {string} code - The `code` parameter is the authorization code that you received from the authorization server after the user has granted permission to
 * your application. This code is used to exchange for an access token.
 * @param {string} clientId - The `clientId` parameter is the identifier for the client application that is requesting the access token. It is typically provided
 * by the authorization server when registering the client application.
 * @param {string} redirectUri - The `redirectUri` parameter is the redirection URI that will be sent to the authorization server.
 * @returns a Promise that resolves to a TokenResponse object.
 */
async function getAccessToken(tokenEndpoint: URL, code: string, clientId: string, redirectUri: string) {
	return await fetch(tokenEndpoint, {
		method: "POST",
		body: new URLSearchParams({
			"grant_type": "authorization_code",
			"code": code,
			"redirect_uri": redirectUri,
			"client_id": clientId
		})
	})
		.then(async (response) => await response.json())
		.then(json => {
			const tokenResponse = json as FhirClientTypes.TokenResponse
			if (!tokenResponse.access_token) throw new Error("Could not find any access token from the oauth endpoint's response")
			return tokenResponse
		})
}

/**
 * The codeToJwt function decodes a JWT token using the jwt_decode library.
 * @param {string} code - The `code` parameter is a string that represents a JSON Web Token (JWT).
 * @returns the decoded JSON Web Token (JWT) object.
 */
function codeToJwt(code: string) {
	return jwt_decode<JWT>(code)
}

/**
 * The function retrieves a JWT token from the browser URL parameters.
 * @returns a string value.
 */
function getCodeFromBrowserUrl(): string {
	const urlParams = new URLSearchParams(window.location.search)
	const code = urlParams.get("code")
	if (code === null) throw new Error("Could not find any JWT token.")
	return code
}

