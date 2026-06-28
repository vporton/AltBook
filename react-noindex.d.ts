export {};

declare module "react" {
  interface HTMLAttributes<T> {
    noindex?: boolean;
  }
}
