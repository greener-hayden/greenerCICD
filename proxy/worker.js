/**
 * Cloudflare Worker for GitHub Webhook Proxy
 *
 * This worker receives GitHub webhooks and triggers GitHub Actions workflows
 * Deploy this to Cloudflare Workers and point your GitHub App webhook to it
 */

// Configuration - set these as Cloudflare Worker environment variables
const CONFIG = {
    GITHUB_OWNER: 'greener-hayden',
    GITHUB_REPO: 'greenerCICD',
    WORKFLOW_FILE: 'webhook-receiver.yml',
    GITHUB_TOKEN: null,  // Set as secret in Cloudflare Worker
    ALLOWED_EVENTS: [
        'installation',
        'installation_repositories',
        'push',
        'pull_request',
        'workflow_run',
        'workflow_job',
        'repository',
        'release',
        'deployment',
        'deployment_status'
    ]
};

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    // Only accept POST requests
    if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        // Get webhook headers
        const event = request.headers.get('X-GitHub-Event');
        const signature = request.headers.get('X-Hub-Signature-256');
        const delivery = request.headers.get('X-GitHub-Delivery');

        // Validate event type
        if (!event) {
            return new Response('Missing X-GitHub-Event header', { status: 400 });
        }

        // Check if event is allowed
        const eventType = event.split('.')[0];
        if (!CONFIG.ALLOWED_EVENTS.includes(eventType)) {
            return new Response(`Event type ${event} not supported`, { status: 200 });
        }

        // Get payload
        const payload = await request.text();

        // Verify webhook signature (optional but recommended)
        if (signature && WEBHOOK_SECRET) {
            const isValid = await verifySignature(payload, signature, WEBHOOK_SECRET);
            if (!isValid) {
                return new Response('Invalid signature', { status: 401 });
            }
        }

        // Encode payload for safe transmission
        const encodedPayload = btoa(payload);

        // Trigger GitHub Actions workflow via repository_dispatch
        const githubResponse = await fetch(
            `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/dispatches`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'Authorization': `token ${GITHUB_TOKEN || CONFIG.GITHUB_TOKEN}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Greener-CI-CD-Webhook-Proxy'
                },
                body: JSON.stringify({
                    event_type: 'app_webhook',
                    client_payload: {
                        event: event,
                        payload: encodedPayload,
                        signature: signature || ''
                    }
                })
            }
        );

        if (githubResponse.status === 204) {
            // Log successful webhook
            console.log(`Webhook forwarded: ${event} (${delivery})`);

            return new Response(JSON.stringify({
                success: true,
                event: event,
                delivery: delivery,
                message: 'Webhook forwarded to GitHub Actions'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } else {
            const error = await githubResponse.text();
            console.error(`GitHub API error: ${githubResponse.status} - ${error}`);

            return new Response(JSON.stringify({
                success: false,
                error: `GitHub API error: ${githubResponse.status}`,
                details: error
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
    } catch (error) {
        console.error('Webhook proxy error:', error);

        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}

/**
 * Verify GitHub webhook signature
 */
async function verifySignature(payload, signature, secret) {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
    );

    const signatureBytes = hexToBytes(signature.replace('sha256=', ''));

    return crypto.subtle.verify(
        'HMAC',
        key,
        signatureBytes,
        data
    );
}

/**
 * Convert hex string to byte array
 */
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}

/**
 * Handle CORS preflight requests (if needed)
 */
async function handleOptions(request) {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-GitHub-Event, X-Hub-Signature-256, X-GitHub-Delivery',
            'Access-Control-Max-Age': '86400'
        }
    });
}