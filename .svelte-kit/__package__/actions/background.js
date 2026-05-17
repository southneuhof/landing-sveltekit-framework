function getManifestUrl(imageSrc) {
    try {
        const url = new URL(imageSrc, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        return `/api/image/manifest${url.pathname}`;
    }
    catch {
        return '';
    }
}
function getBaseDir(imageSrc) {
    try {
        const url = new URL(imageSrc, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        return url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
    }
    catch {
        return '';
    }
}
export function background(node, imageUrl) {
    let activeRequest = 0;
    async function optimize() {
        const requestId = ++activeRequest;
        if (!imageUrl)
            return;
        const manifestUrl = getManifestUrl(imageUrl);
        if (!manifestUrl)
            return;
        try {
            const response = await fetch(manifestUrl);
            if (!response.ok || requestId !== activeRequest)
                return;
            const manifest = await response.json();
            const bestVariant = manifest.variants
                .filter((variant) => variant.format === 'webp')
                .sort((a, b) => b.width - a.width)[0];
            if (!bestVariant)
                return;
            const optimizedUrl = bestVariant.url ?? `${getBaseDir(imageUrl)}${bestVariant.path}`;
            const currentBackground = node.style.backgroundImage;
            if (!currentBackground)
                return;
            node.style.backgroundImage = currentBackground.replace(new RegExp(escapeRegExp(imageUrl), 'g'), optimizedUrl);
        }
        catch {
            // Keep the original background image.
        }
    }
    optimize();
    return {
        update(newUrl) {
            imageUrl = newUrl;
            optimize();
        },
        destroy() {
            activeRequest++;
        },
    };
}
export function buildBackgroundStyle(imageUrl, options = {}) {
    if (!imageUrl)
        return '';
    const { overlay = false, overlayGradient = 'linear-gradient(rgba(0,0,0,0.16), rgba(0,0,0,0.16)), linear-gradient(to top, rgba(0,0,0,0.33) 0%, rgba(0,0,0,0) 50%)', } = options;
    return overlay ? `${overlayGradient}, url('${imageUrl}')` : `url('${imageUrl}')`;
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
