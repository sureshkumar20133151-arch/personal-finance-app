export function getFriendlyAuthErrorMessage(err, defaultMsg = "Authentication failed. Please try again.") {
    if (!err) return defaultMsg;
    const code = err.code || "";
    const msg = String(err.message || "");

    if (code === "auth/popup-closed-by-user") {
        return "Sign-in popup was closed before completing.";
    }
    if (code === "auth/popup-blocked") {
        return "Sign-in popup was blocked by your browser. Please allow popups for this site.";
    }
    if (code === "auth/cancelled-popup-request") {
        return "Sign-in request was cancelled.";
    }
    if (code === "auth/unauthorized-domain") {
        return "This domain is not authorized in Firebase Console. Please add this domain under Firebase Authentication > Settings > Authorized domains.";
    }
    if (
        code === "auth/network-request-failed" ||
        code === "auth/internal-error" ||
        msg.includes("internal-error") ||
        msg.includes("network")
    ) {
        return "Network connection to Google failed. Please check your internet connection, refresh the page, or disable ad-blocker extensions that might block Google services.";
    }
    if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        return "Invalid email or password. Please check your credentials.";
    }
    if (code === "auth/email-already-in-use") {
        return "An account with this email already exists. Please sign in instead.";
    }
    if (code === "auth/weak-password") {
        return "Password must be at least 6 characters long.";
    }
    return msg || defaultMsg;
}
