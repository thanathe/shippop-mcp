# The default environment is SHIPPOP dev, not production

`SHIPPOP_ENV` defaults to `dev` (`mkpservice.shippop.dev`); production (`mkpservice.shippop.com`) must be opted into explicitly. This inverts the usual "unset = production" convention on purpose: the package is distributed publicly via `npx`, and a first-time user pasting a config snippet should not be able to confirm a paid shipment against their live account by accident. Every tool result reports which environment it ran against so the model can surface it.
