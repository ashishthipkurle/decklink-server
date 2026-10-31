// We accept the routerFn as an argument to avoid circular dependency.

// To avoid circular dependency, we'll accept the handleCommand function as an argument,
// or we can resolve it lazily.
async function executeMultiAction(payload, routerFn) {
  const { actions } = payload;
  if (!Array.isArray(actions)) throw new Error('Multi-action requires an array of actions');

  for (const step of actions) {
    const { delayMs, action, actionPayload } = step;
    
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    if (action && actionPayload) {
      // Execute the sub-action
      await routerFn({ action, payload: actionPayload });
    }
  }
}

export { executeMultiAction };
