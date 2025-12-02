// LibreLinkUp API helper for QML
// Based on https://github.com/DiaKEM/libre-link-up-api-client

.pragma library

// Use EU2 directly for Europe
var API_URL = "https://api-eu2.libreview.io"
var LOGIN_ENDPOINT = "/llu/auth/login"
var CONNECTIONS_ENDPOINT = "/llu/connections"
var CLIENT_VERSION = "4.12.0"
var PRODUCT = "llu.android"

// Regional API endpoints (for reference)
var REGIONAL_ENDPOINTS = {
    "AE": "api-ae.libreview.io",
    "AP": "api-ap.libreview.io",
    "AU": "api-au.libreview.io",
    "CA": "api-ca.libreview.io",
    "DE": "api-de.libreview.io",
    "EU": "api-eu.libreview.io",
    "EU2": "api-eu2.libreview.io",
    "FR": "api-fr.libreview.io",
    "JP": "api-jp.libreview.io",
    "US": "api-us.libreview.io"
}

// Cached auth data
var _authToken = null
var _connectionId = null

// Standard headers for API requests
function getHeaders(token) {
    var headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "version": CLIENT_VERSION,
        "product": PRODUCT,
        "Cache-Control": "no-cache"
    }
    if (token) {
        headers["Authorization"] = "Bearer " + token
    }
    return headers
}

// Make HTTP request
function makeRequest(method, url, headers, body, callback) {
    var xhr = new XMLHttpRequest()

    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            console.log("LibreAPI: Response status:", xhr.status, "for", url)

            if (xhr.status === 0) {
                // Status 0 usually means network error or CORS block
                callback("Network error (status 0) - possible CORS issue")
                return
            }

            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    var response = JSON.parse(xhr.responseText)
                    callback(null, response)
                } catch (e) {
                    callback("Failed to parse response: " + e.message)
                }
            } else {
                var errorDetail = xhr.responseText ? xhr.responseText.substring(0, 200) : "No response body"
                callback("HTTP " + xhr.status + ": " + xhr.statusText + " - " + errorDetail)
            }
        }
    }

    xhr.onerror = function(e) {
        console.log("LibreAPI: XHR error event for", url)
        callback("Network error - request failed")
    }

    xhr.ontimeout = function() {
        callback("Request timed out")
    }

    try {
        xhr.open(method, url, true)
        xhr.timeout = 30000 // 30 second timeout

        for (var header in headers) {
            xhr.setRequestHeader(header, headers[header])
        }

        console.log("LibreAPI: Sending", method, "to", url)

        if (body) {
            xhr.send(JSON.stringify(body))
        } else {
            xhr.send()
        }
    } catch (e) {
        callback("Failed to send request: " + e.message)
    }
}

// Login to LibreLinkUp
function login(username, password, callback) {
    var url = API_URL + LOGIN_ENDPOINT
    var headers = getHeaders()
    var body = {
        email: username,
        password: password
    }

    makeRequest("POST", url, headers, body, function(error, response) {
        if (error) {
            callback({ error: "Login failed: " + error })
            return
        }

        if (response.status === 0 && response.data) {
            // Check for redirect to regional server
            if (response.data.redirect && response.data.region) {
                var regionalHost = REGIONAL_ENDPOINTS[response.data.region]
                if (regionalHost) {
                    API_URL = "https://" + regionalHost
                    // Retry login with regional endpoint
                    login(username, password, callback)
                    return
                }
            }

            // Successful login
            if (response.data.authTicket && response.data.authTicket.token) {
                _authToken = response.data.authTicket.token
                callback({ token: _authToken })
            } else {
                callback({ error: "No auth token in response" })
            }
        } else {
            var errorMsg = response.error ? response.error.message : "Unknown login error"
            callback({ error: errorMsg })
        }
    })
}

// Get patient connections (includes glucose data)
function getConnections(token, callback) {
    var url = API_URL + CONNECTIONS_ENDPOINT
    var headers = getHeaders(token)

    makeRequest("GET", url, headers, null, function(error, response) {
        if (error) {
            callback({ error: "Failed to get connections: " + error })
            return
        }

        if (response.status === 0 && response.data) {
            callback({ connections: response.data })
        } else {
            var errorMsg = response.error ? response.error.message : "Failed to get connections"
            callback({ error: errorMsg })
        }
    })
}

// Extract glucose data from connection object
function extractGlucoseFromConnection(connection, callback) {
    var glucoseItem = connection.glucoseMeasurement
    if (glucoseItem) {
        callback({
            value: glucoseItem.ValueInMgPerDl || glucoseItem.Value,
            trend: glucoseItem.TrendArrow,
            timestamp: glucoseItem.Timestamp,
            isHigh: glucoseItem.isHigh || false,
            isLow: glucoseItem.isLow || false
        })
    } else {
        callback({ error: "No glucose measurement available" })
    }
}

// Main function to get glucose reading
function getGlucoseReading(username, password, callback) {
    // Always login fresh to ensure we get latest data
    // (Connections endpoint returns glucose data directly)
    login(username, password, function(loginResult) {
        if (loginResult.error) {
            callback(loginResult)
            return
        }

        _authToken = loginResult.token

        // Get connections (includes glucose measurement)
        getConnections(_authToken, function(connResult) {
            if (connResult.error) {
                callback(connResult)
                return
            }

            if (!connResult.connections || connResult.connections.length === 0) {
                callback({ error: "No linked patients found. Share your glucose in LibreLink app first." })
                return
            }

            // Use first connection (primary patient) - already has glucose data
            var connection = connResult.connections[0]
            _connectionId = connection.patientId

            // Extract glucose from connection response
            extractGlucoseFromConnection(connection, callback)
        })
    })
}

// Clear cached authentication (for logout)
function clearAuth() {
    _authToken = null
    _connectionId = null
}
