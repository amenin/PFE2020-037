const REACT_APP_API_URL = "http://localhost:5000";

export const fetchFromBackendGet = async (route) => {
    try {
        const response = await fetch(`${REACT_APP_API_URL}/api/${route}`);
        const responseJson = await response.json();
        return responseJson;
    } catch (err) {
        console.log(`### ${err}`);
        throw err;
    }
};

export const fetchFromBackendPost = async (route, body) => {
    try {
        const response = await fetch(`${REACT_APP_API_URL}/api/${route}`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        const responseJson = await response.json();
        return responseJson;
    } catch (err) {
        console.log(`### ${err}`);
        throw err;
    }
};
