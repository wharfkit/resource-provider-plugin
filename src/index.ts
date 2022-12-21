import {
    ABIDef,
    AbiProvider,
    AbstractTransactPlugin,
    Asset,
    AssetType,
    Name,
    Signature,
    SigningRequest,
    TransactContext,
    TransactHookResponse,
    TransactHookTypes,
} from '@wharfkit/session'

import zlib from 'pako'

interface ResourceProviderOptions {
    allowFees?: boolean
    url?: string
}

interface ResourceProviderResponseData {
    request: [string, object]
    signatures: string[]
    version: unknown
    fee?: AssetType
    costs?: {
        cpu: AssetType
        net: AssetType
        ram: AssetType
    }
}

interface ResourceProviderResponse {
    code: number
    data: ResourceProviderResponseData
}

export class ResourceProviderPlugin extends AbstractTransactPlugin {
    readonly allowFees: boolean = false
    readonly url?: string

    constructor(options: ResourceProviderOptions) {
        super()
        if (typeof options.allowFees !== 'undefined') {
            this.allowFees = options.allowFees
        }
        if (options.url) {
            this.url = options.url
        }
    }

    register(context: TransactContext): void {
        context.addHook(TransactHookTypes.beforeSign, (request, context) =>
            this.request(request, context)
        )
    }

    async request(
        request: SigningRequest,
        context: TransactContext
    ): Promise<TransactHookResponse> {
        // Validate that this request is valid for the resource provider
        this.validateRequest(request, context)

        // Perform the request to the resource provider.
        const response = await context.fetch(this.url, {
            method: 'POST',
            body: JSON.stringify({
                ref: 'unittest',
                request,
                signer: context.session,
            }),
        })
        const json: ResourceProviderResponse = await response.json()

        // If the resource provider refused to process this request, return the original request without modification.
        if (response.status === 400) {
            return {
                request,
            }
        }

        // If the resource provider offered transaction with a fee, but plugin doesn't allow fees, return the original transaction.
        if (response.status === 402 && this.allowFees === false) {
            // TODO: Notify the script somehow of this, maybe we need an optional logger?
            return {
                request,
            }
        }

        // Validate that the response is valid for the session.
        await this.validateResponseData(json)

        // NYI: Interact with interface via context for fee based prompting

        /* Psuedo-code for fee based prompting

        if (response.status === 402) {

            // Prompt for the fee acceptance
            const promptResponse = context.userPrompt({
                title: 'Transaction Fee Required',
                message: `This transaction requires a fee of ${response.json.data.fee} EOS. Do you wish to accept this fee?`,
            })

            // If the user did not accept the fee, return the original request without modification.
            if (!promptResponse) {
                return {
                    request,
                }
            }
        } */

        // Create a new signing request based on the response to return to the session's transact flow.
        const modified = await this.createRequest(json, context)

        // Return the modified transaction and additional signatures
        return {
            request: modified,
            signatures: json.data.signatures.map((sig) => Signature.from(sig)),
        }
    }

    async createRequest(
        response: ResourceProviderResponse,
        context: TransactContext
    ): Promise<SigningRequest> {
        // Establish an AbiProvider based on the session context.
        const abiProvider: AbiProvider = {
            getAbi: async (account: Name): Promise<ABIDef> => {
                const response = await context.client.v1.chain.get_abi(account)
                if (!response.abi) {
                    /* istanbul ignore next */
                    throw new Error('could not load abi') // TODO: Better coverage for this
                }
                return response.abi
            },
        }

        // Create a new signing request based on the response to return to the session's transact flow.
        const request = await SigningRequest.create(
            {transaction: response.data.request[1]},
            {
                abiProvider,
                zlib,
            }
        )

        // Set the required fee onto the request itself for wallets to process.
        if (response.code === 402 && response.data.fee) {
            request.setInfoKey('txfee', Asset.from(response.data.fee))
        }

        // If the fee costs exist, set them on the request for the signature provider to consume
        if (response.data.costs) {
            request.setInfoKey('txfeecpu', response.data.costs.cpu)
            request.setInfoKey('txfeenet', response.data.costs.net)
            request.setInfoKey('txfeeram', response.data.costs.ram)
        }

        return request
    }
    /**
     * Perform validation against the request to ensure it is valid for the resource provider.
     */
    validateRequest(request: SigningRequest, context: TransactContext): void {
        // Retrieve first authorizer and ensure it matches session context.
        const firstAction = request.getRawActions()[0]
        const firstAuthorizer = firstAction.authorization[0]
        if (!firstAuthorizer.actor.equals(context.session.actor)) {
            throw new Error('The first authorizer of the transaction does not match this session.')
        }
    }
    /**
     * Perform validation against the response to ensure it is valid for the session.
     */
    async validateResponseData(response: Record<string, any>): Promise<void> {
        // If the data wasn't provided in the response, throw an error.
        if (!response) {
            throw new Error('Resource provider did not respond to the request.')
        }

        // If a malformed response with a fee was provided, throw an error.
        if (response.code === 402 && !response.data.fee) {
            throw new Error(
                'Resource provider returned a response indicating required payment, but provided no fee amount.'
            )
        }

        // If no signatures were provided, throw an error.
        if (!response.data.signatures || !response.data.signatures[0]) {
            throw new Error('Resource provider did not return a signature.')
        }
    }
}
