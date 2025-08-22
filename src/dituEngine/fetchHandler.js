const request = async (
  method,
  uri,
  options = {},
  body = null,
  shouldThrowOfflineError = false
) => {
  const composedBaseURL = import.meta.env.VITE_API_BASE_URL;
  const url = `${composedBaseURL}${uri}`;
  const headers = {
    "Content-Type": "application/json",
    restful: "yes",
    ...options.headers,
  };

  const config = {
    method,
    headers,
    ...options,
  };

  if (body && (method === "POST" || method === "PUT")) {
    config.body = JSON.stringify(body);
  }

  // Debug: Log outgoing API request
  console.info("[fetchHandler] Request:", { method, url, config });

  try {
    if (shouldThrowOfflineError && !functions.isOnline()) {
      throw new Error("Offline error: No internet connection.");
    }
    const shouldProceed = await functions.checkIfIsOnline(
      shouldThrowOfflineError
    );
    if (shouldProceed) {
      const response = await fetch(url, config);
      // Debug: Log API response status
      console.info("[fetchHandler] Response status:", response.status, url);
      if (!response.ok) {
        const error = new Error(
          `HTTP error! status: ${response.status} uri: ${uri}`
        );
        const errorResponse = await response.json();
        functions.handleSystemTime(errorResponse);
        error.response = errorResponse;
        error.response.status = response.status;
        // Debug: Log error response
        console.error("[fetchHandler] Error response:", errorResponse);
        throw error;
      }
      const responseBody = await response.json();
      functions.handleSystemTime(responseBody);
      // Debug: Log API response body
      console.info("[fetchHandler] Response body:", responseBody);
      return responseBody;
    }
  } catch (error) {
    console.error("API call failed:", error, uri);
    if (!functions.isOnline()) {
      throw new Error("Offline error: No internet connection.");
    }
    throw error;
  }
};

const fetchHandler = (shouldThrowOfflineError) => {
  return {
    get: (uri, options = {}) =>
      request("GET", uri, options, null, shouldThrowOfflineError),
    post: (uri, body, options = {}) =>
      request("POST", uri, options, body, shouldThrowOfflineError),
    put: (uri, body, options = {}) =>
      request("PUT", uri, options, body, shouldThrowOfflineError),
  };
};

export default fetchHandler;
