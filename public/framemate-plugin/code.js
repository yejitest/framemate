// Framemate Plugin Runner
// Receives generated plugin code from the UI and executes it in Figma context

figma.showUI(__html__, {
  width: 540,
  height: 400,
  title: 'Framemate',
  themeColors: true,
});

figma.ui.onmessage = async function (msg) {
  if (msg.type === 'run') {
    try {
      // Execute the Framemate-generated async IIFE code
      // The code ends with figma.closePlugin() which closes the plugin with a toast
      await eval(msg.code); // eslint-disable-line no-eval
    } catch (err) {
      // If execution fails (before closePlugin is reached), notify the UI
      figma.ui.postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
};
