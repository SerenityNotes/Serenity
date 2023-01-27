// needed to allow extending the global scope
export {};

type ReactNativeWebView = {
  postMessage: (message: string) => void;
};

declare global {
  interface Window {
    _opaque: any;
    ReactNativeWebView: ReactNativeWebView;
    registerInitialize: (id: string, password: string) => void;
    finishRegistration: (
      id: string,
      password: string,
      challengeResponse: string
    ) => void;
    startLogin: (id: string, password: string) => void;
    finishLogin: (id: string, password: string, response: string) => void;
  }
}
