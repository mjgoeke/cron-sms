export const setTimeoutPromise = (delay) => {
    let timer = 0;
    let reject = null;
    const promise = new Promise((resolve, _reject) => {
        reject = _reject;
        timer = setTimout(resolve, delay);
    });
    const cancel = () => {
        if (timer) {
            clearTimeout(timer);
            timer = 0;
            reject();
            reject = null;
        }
    }
    return { promise, cancel };
}