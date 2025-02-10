# Circle Paymaster `aa-sdk` Middleware

This provides an easy integration with [Circle Paymaster](https://developers.circle.com/stablecoins/paymaster-overview) using Alchemy's [aa-sdk](https://github.com/alchemyplatform/aa-sdk). See [`example/index.ts`](example/index.ts) for example usage.

## Installation

```
$ npm install circle-paymaster-aa-sdk-middleware
```

## Usage

For a more complete example, see [`example/index.ts`](example/index.ts).

```typescript
import { generatePrivateKey } from 'viem/accounts';
import { createLightAccount } from '@account-kit/smart-contracts';
import { createSmartAccountClient, getEntryPoint, LocalAccountSigner } from '@aa-sdk/core';
import { alchemy, alchemyFeeEstimator, arbitrumSepolia } from '@account-kit/infra';
import { circlePaymasterMiddleware, getContracts } from 'circle-paymaster-aa-sdk-middleware';
import fs from 'node:fs';

const ownerKey = (
  fs.existsSync('.owner_private_key')
    ? fs.readFileSync('.owner_private_key', 'utf8')
    : (() => {
        const privateKey = generatePrivateKey();
        fs.writeFileSync('.owner_private_key', privateKey);
        return privateKey;
      })()
) as `0x${string}`;

const chain = arbitrumSepolia;

const transport = alchemy({
  apiKey: process.env.ALCHEMY_KEY as string
});

const account = await createLightAccount({
  chain,
  transport,
  entryPoint: getEntryPoint(arbitrumSepolia, { version: '0.7.0' }),
  signer: LocalAccountSigner.privateKeyToAccountSigner(ownerKey)
});

const smartAccountClient = createSmartAccountClient({
  chain,
  transport,
  account,
  feeEstimator: alchemyFeeEstimator(transport),
  ...circlePaymasterMiddleware()
});

const { usdcContract } = getContracts(smartAccountClient);
if ((await usdcContract.read.balanceOf([account.address])) < 1000000) {
  console.log(`Fund ${account.address} with USDC from https://faucet.circle.com, then run this again.`);
  process.exit();
}

// await smartAccountClient.sendUserOperation({ ... })
```

## Example

To run the example script, clone this repository and then:

```
$ echo 'export ALCHEMY_KEY="<your-alchemy-key>"' > .env
$ npm install
$ npm run example
```
