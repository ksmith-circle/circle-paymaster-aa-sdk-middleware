import { formatEther, formatUnits, hexToBigInt, type Hex } from 'viem';
import { generatePrivateKey } from 'viem/accounts';
import { createLightAccount } from '@account-kit/smart-contracts';
import { createSmartAccountClient, getEntryPoint, LocalAccountSigner } from '@aa-sdk/core';
import { alchemy, alchemyFeeEstimator, arbitrumSepolia } from '@account-kit/infra';
import { circlePaymasterMiddleware, getContracts } from '../src';
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
const usdcBalance = await usdcContract.read.balanceOf([account.address]);
if (usdcBalance < 1000000) {
  console.log(`Fund ${account.address} with USDC from https://faucet.circle.com, then run this again.`);
  process.exit();
}

const sent = await smartAccountClient.sendUserOperation({
  // Zero-value self-transfer
  uo: {
    target: account.address,
    value: 0n,
    data: '0x'
  }
});

console.log('Sent user op:', sent.hash);

const txHash = await smartAccountClient.waitForUserOperationTransaction({
  hash: sent.hash
});

console.log('User op included in tx:', txHash);

const receipt = await smartAccountClient.getUserOperationReceipt(sent.hash);

const actualGasCost = hexToBigInt(receipt?.actualGasCost as Hex);
console.log('Actual gas cost (paid by paymaster):', formatEther(actualGasCost), 'ETH');

const balanceAfter = await usdcContract.read.balanceOf([account.address]);
const usdcPaid = usdcBalance - balanceAfter;
console.log('USDC cost (paid by smart account):', formatUnits(usdcPaid, 6), 'USDC');
