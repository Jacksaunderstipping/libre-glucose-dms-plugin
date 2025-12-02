#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Config path
const PLUGIN_SETTINGS_PATH = path.join(os.homedir(), '.config', 'DankMaterialShell', 'plugin_settings.json');

// Load config
let config = {
    username: '',
    password: '',
    glucoseUnit: 'mmol/L',
    lowThreshold: 4,
    highThreshold: 10
};

try {
    if (fs.existsSync(PLUGIN_SETTINGS_PATH)) {
        const settings = JSON.parse(fs.readFileSync(PLUGIN_SETTINGS_PATH, 'utf8'));
        if (settings.libreGlucose) {
            config = { ...config, ...settings.libreGlucose };
        }
    }
} catch (e) {
    console.log(JSON.stringify({ error: 'Config load failed: ' + e.message }));
    process.exit(1);
}

if (!config.username || !config.password) {
    console.log(JSON.stringify({ error: 'Not configured - set credentials in settings' }));
    process.exit(0);
}

// API endpoint
let API_BASE = 'https://api.libreview.io';

// Regional endpoints
const REGIONAL_HOSTS = {
    'AE': 'https://api-ae.libreview.io',
    'AP': 'https://api-ap.libreview.io',
    'AU': 'https://api-au.libreview.io',
    'CA': 'https://api-ca.libreview.io',
    'DE': 'https://api-de.libreview.io',
    'EU': 'https://api-eu.libreview.io',
    'EU2': 'https://api-eu2.libreview.io',
    'FR': 'https://api-fr.libreview.io',
    'JP': 'https://api-jp.libreview.io',
    'US': 'https://api-us.libreview.io'
};

// Cached account ID hash
let accountIdHash = '';

// Make request using curl
function curlRequest(method, endpoint, data = null, authToken = null) {
    const args = [
        '-s',
        '-X', method,
        '-H', 'Content-Type: application/json',
        '-H', 'product: llu.android',
        '-H', 'version: 4.16.0'
    ];

    if (authToken) {
        args.push('-H', `Authorization: Bearer ${authToken}`);
    }

    if (accountIdHash) {
        args.push('-H', `account-id: ${accountIdHash}`);
    }

    if (data) {
        args.push('-d', JSON.stringify(data));
    }

    args.push(API_BASE + endpoint);

    try {
        const result = require('child_process').spawnSync('curl', args, {
            encoding: 'utf8',
            timeout: 30000
        });

        if (result.error) {
            throw result.error;
        }

        if (result.stderr && result.status !== 0) {
            throw new Error(result.stderr);
        }

        return JSON.parse(result.stdout);
    } catch (e) {
        throw new Error('Request failed: ' + e.message);
    }
}

// Get trend arrow (LibreLinkUp codes: 1=falling fast, 4=stable, 7=rising fast)
function getTrendArrow(trendCode) {
    const arrows = {
        1: '⇊',  // Falling fast
        2: '↓',  // Falling
        3: '↘',  // Falling slowly
        4: '→',  // Stable
        5: '↗',  // Rising slowly
        6: '↑',  // Rising
        7: '⇈'   // Rising fast
    };
    return arrows[trendCode] || '';
}

// Get level indicator (LOW/HIGH)
function getLevelIndicator(mmolValue, lowThreshold, highThreshold) {
    if (mmolValue < lowThreshold) return 'LOW';
    if (mmolValue > highThreshold) return 'HIGH';
    return '';
}

// Get color based on glucose level
function getColor(mmolValue, lowThreshold, highThreshold) {
    if (mmolValue < lowThreshold) return '#E53935';
    if (mmolValue > highThreshold) return '#FB8C00';
    return '#43A047';
}

// Login with redirect handling
function login() {
    const response = curlRequest('POST', '/llu/auth/login', {
        email: config.username,
        password: config.password
    });

    // Handle redirect
    if (response.data?.redirect && response.data?.region) {
        const regionalBase = REGIONAL_HOSTS[response.data.region];
        if (regionalBase) {
            API_BASE = regionalBase;
            return login();
        }
    }

    return response;
}

// Main
function main() {
    try {
        const authResponse = login();

        if (authResponse.status !== 0) {
            console.log(JSON.stringify({
                error: authResponse.error?.message || 'Authentication failed'
            }));
            return;
        }

        if (!authResponse.data?.authTicket?.token) {
            console.log(JSON.stringify({ error: 'No auth token received' }));
            return;
        }

        const token = authResponse.data.authTicket.token;

        // Set account ID hash for subsequent requests
        if (authResponse.data.user?.id) {
            accountIdHash = crypto.createHash('sha256')
                .update(authResponse.data.user.id)
                .digest('hex');
        }

        // Get connections
        const connResponse = curlRequest('GET', '/llu/connections', null, token);

        if (connResponse.status !== 0) {
            console.log(JSON.stringify({
                error: connResponse.error?.message || 'Failed to get connections'
            }));
            return;
        }

        if (!connResponse.data || connResponse.data.length === 0) {
            console.log(JSON.stringify({ error: 'No linked patients found' }));
            return;
        }

        const glucose = connResponse.data[0].glucoseMeasurement;

        if (!glucose) {
            console.log(JSON.stringify({ error: 'No glucose measurement' }));
            return;
        }

        const mgValue = glucose.ValueInMgPerDl || glucose.Value;
        const mmolValue = mgValue / 18.0182;

        const displayValue = config.glucoseUnit === 'mg/dL'
            ? Math.round(mgValue).toString()
            : mmolValue.toFixed(1);

        const levelIndicator = getLevelIndicator(mmolValue, config.lowThreshold, config.highThreshold);

        console.log(JSON.stringify({
            value: displayValue,
            rawValue: mgValue,
            mmolValue: mmolValue.toFixed(1),
            trend: glucose.TrendArrow,
            arrow: getTrendArrow(glucose.TrendArrow),
            level: levelIndicator,
            color: getColor(mmolValue, config.lowThreshold, config.highThreshold),
            unit: config.glucoseUnit,
            timestamp: glucose.Timestamp
        }));

    } catch (e) {
        console.log(JSON.stringify({ error: 'Fetch failed: ' + e.message }));
    }
}

main();
