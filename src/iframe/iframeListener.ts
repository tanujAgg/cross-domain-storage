import {
    IframeRoutes,
    IframeListener,
    AppRequest,
    IframeResponse,
    AppConfig,
    IframeRouteEndpoint,
    DependentDomainSpecs,
} from '../common/types';
import { getHostnameAndPort } from '../common/urlUtils';
import { REQUEST_TYPE_SET, REQUEST_TYPE_GET, REQUEST_TYPE_RESPONSE } from '../common/constants';

/**
 * In this file we create the single listener for the iframe.
 * Once a message is posted to the iframe, this file receives
 * it, ensures the sender is on the list of dependent sites,
 * then routes the request to the proper data getter.
 */
interface SetIframeListenerProps {
    routes: IframeRoutes,
    dependentDomainSpecs: DependentDomainSpecs
}
export const setIframeListener = ({ routes, dependentDomainSpecs }: SetIframeListenerProps) => {
    const iframeListener: IframeListener = async ({ origin, data: appRequestPayload }) => {
        // This is the filter, to ensure only requests from access-listed domains
        // have access to the hub domain's data. If this request came from one of
        // the domains on the user-defined dependent list, allow it access.
        if (isApprovedHost(dependentDomainSpecs, origin)) {

            let type
            let config
            try {

                // Retrieve the key and data from the request:
                const requestSpecs: AppRequest = JSON.parse(appRequestPayload);
                config = requestSpecs.config
                type = requestSpecs.type

            } catch (e) {

                // Guess it wasn't one of ours.
                // Logging here might not be a bad idea, but also might get noisy
                // if ads and whatnot started emitting to this iframe.
                return

            }

            // Retrieve the proper handler:
            const handler = getEndpoint(type, config.dataKey, routes)
            if (!handler) {
                return
            }

            // Execute the handler for the handler:
            const response = await executeRoute(handler, config)

            // Emit the result back to the host application:
            window.parent.postMessage(JSON.stringify(response), origin);

        } else {
            // Emit the error back to the host application:
            const response = composeErrorResponse("", "Not allowed to perform this operation.");
            window.parent.postMessage(JSON.stringify(response), origin);
        }
    };

    // Add the event listener to start tracking the calls:
    window.addEventListener('message', iframeListener, false);
}

// Determine the handler the request is destined for:
const getEndpoint = (
    requestType: string,
    dataKey: string,
    routes: IframeRoutes
): IframeRouteEndpoint | null => {

    let handler

    if (requestType === REQUEST_TYPE_SET) {

        // The app has requested to set a data value:
        handler = routes[REQUEST_TYPE_SET]

    } else if (routes[dataKey]) {

        // There is a custom handler set up for this `dataKey`.
        handler = routes[dataKey]

    } else if (requestType === REQUEST_TYPE_GET) {

        // This is a generic get request, without a custom handler.
        handler = routes[REQUEST_TYPE_GET]

    } else {

        // The `requestType` of this request wasn't valid.  The request wasn't
        // intended for us.
        handler = null

    }

    return handler
}

// Attempt to execute the handler for this request, and record the error
// for it if anything goes awry:
const executeRoute = async (handler: IframeRouteEndpoint, config: AppConfig): Promise<IframeResponse> => {

    let response

    try {
        response = await handler(config);
    } catch (e) {
        response = composeErrorResponse(config.dataKey, e.message)
    }

    return response
}

// Structure an error response:
const composeErrorResponse = (dataKey: string, errorMessage: string) => ({
    type: REQUEST_TYPE_RESPONSE,
    dataKey: dataKey,
    error: errorMessage
})

/**
 * Confirm the request's origin is on the access list:
 * @param dependentDomainSpecs List of host specs
 * @param origin Address of incoming request
 */
const isApprovedHost = (dependentDomainSpecs: DependentDomainSpecs, origin: string): boolean => {
    const {
        hostname: requestHost,
        port: requestPort
    } = getHostnameAndPort(origin);

    // Check the origin against each access-listed domain to see if there's a match:
    return dependentDomainSpecs.some(({ hostname, port }) => (
        // Ensure host names match:
        requestHost === hostname &&
        // If a dependent host was specified, ensure the request's port matches it:
        (!port || requestPort === port)
    ))
}
