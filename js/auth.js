/**
 * auth.js
 * Handles User Authentication and Cloud Storage Sync via Google Apps Script
 */

const AuthService = {
    // --- Configuration ---
    // REPLACE THIS URL with your deployed Web App URL from Google Apps Script
    API_URL: "",

    // --- State ---
    currentUser: null,
    isLoggedIn: false,

    // --- Core Methods ---

    /**
     * Set the API URL dynamically (e.g. from UI input)
     */
    setApiUrl(url) {
        let cleanUrl = url.trim();
        // Remove trailing / if exists
        if (cleanUrl.endsWith('/')) {
            cleanUrl = cleanUrl.slice(0, -1);
        }
        // Basic validation warning (console only) if it doesn't look like a GAS Web App
        if (!cleanUrl.includes('script.google.com')) {
            console.warn("URL does not look like a Google Apps Script URL");
        }
        this.API_URL = cleanUrl;
        localStorage.setItem('gas_api_url', this.API_URL);
    },

    getApiUrl() {
        if (!this.API_URL) {
            this.API_URL = localStorage.getItem('gas_api_url') || "";
        }
        return this.API_URL;
    },

    /**
     * Helper to perform POST request using URLSearchParams
     */
    async _postRequest(params) {
        if (!this.getApiUrl()) return { success: false, message: "Vui lòng nhập URL API Google Script trước!" };

        try {
            const searchParams = new URLSearchParams();
            for (const key in params) {
                searchParams.append(key, params[key]);
            }

            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: searchParams
            });

            // Attempt to parse JSON, if fails read text
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error("JSON Parse Error. Raw response:", text);
                return { success: false, message: "Server trả về lỗi không xác định (HTML)." };
            }

        } catch (error) {
            console.error("Network/Fetch Error:", error);
            return { success: false, message: "Lỗi kết nối mạng hoặc chặn CORS." };
        }
    },

    /**
     * Register a new user
     */
    async register(username, password) {
        return this._postRequest({
            action: 'register',
            username: username,
            password: password
        });
    },

    /**
     * Login existing user
     */
    async login(username, password) {
        const result = await this._postRequest({
            action: 'login',
            username: username,
            password: password
        });

        if (result.success) {
            this.currentUser = { username, password };
            this.isLoggedIn = true;
            localStorage.setItem('current_user', JSON.stringify(this.currentUser));
        }
        return result;
    },

    /**
     * Logout
     */
    logout() {
        this.currentUser = null;
        this.isLoggedIn = false;
        localStorage.removeItem('current_user');
        window.location.reload();
    },

    /**
     * Load Check (Auto Login if valid session persists)
     */
    checkSession() {
        const stored = localStorage.getItem('current_user');
        if (stored) {
            try {
                this.currentUser = JSON.parse(stored);
                this.isLoggedIn = true;
                this.getApiUrl(); // Ensure URL is loaded
                return true;
            } catch (e) {
                console.error("Session parse error", e);
                return false;
            }
        }
        return false;
    },

    /**
     * Load Data from Cloud
     */
    async loadData() {
        if (!this.isLoggedIn || !this.currentUser) return { success: false, message: "Chưa đăng nhập" };

        // Reuse _postRequest for load to be consistent and avoid URL length limits with GET if we expanded params
        // But backend supports GET for load. Let's stick to POST for everything to avoid mixed content/method issues.
        // Backend handleRequest supports POST for 'load' action too.
        const { username, password } = this.currentUser;
        const result = await this._postRequest({
            action: 'load',
            username: username,
            password: password
        });

        if (result.success && result.data) {
            // If data is string (JSONified), parse it
            return { success: true, data: typeof result.data === 'string' ? JSON.parse(result.data) : result.data };
        }
        return result;
    },

    /**
     * Save Data to Cloud
     */
    async saveData(dataObj) {
        if (!this.isLoggedIn || !this.currentUser) return { success: false, message: "Chưa đăng nhập" };

        const { username, password } = this.currentUser;
        const dataStr = JSON.stringify(dataObj);

        return this._postRequest({
            action: 'save',
            username: username,
            password: password,
            data: dataStr
        });
    }
};
