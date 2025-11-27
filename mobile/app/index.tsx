import { Redirect } from 'expo-router';

/**
 * Redirects the root path to the main tabs stack.
 */
export default function IndexRoute() {
  return <Redirect href="/tabs" />;
}
