import { generatePrivateKey } from 'viem/accounts';
import {
  createBundlerClientFromExisting,
  createSmartAccountClientFromExisting,
  getEntryPoint,
  LocalAccountSigner
} from '@aa-sdk/core';
import {
  alchemyFeeEstimator,
  alchemy,
  arbitrumSepolia,
  createAlchemyPublicRpcClient
} from '@account-kit/infra';
import { createLightAccount } from '@account-kit/smart-contracts';
import fs from 'node:fs';
import { circlePaymasterMiddleware } from '../src';
import { getContracts } from '../src/contractHelpers';
import { formatEther, formatUnits, hexToBigInt } from 'viem';
import { Hex } from 'viem';

const transport = alchemy({
  apiKey: process.env.ALCHEMY_KEY as string
});

const client = createAlchemyPublicRpcClient({
  transport,
  chain: arbitrumSepolia
});

const block = await client.getBlockNumber();

console.log(`Current block number: ${block}`);

const ownerKey = (
  fs.existsSync('.owner_private_key')
    ? fs.readFileSync('.owner_private_key', 'utf8')
    : (() => {
        const privateKey = generatePrivateKey();
        fs.writeFileSync('.owner_private_key', privateKey);
        return privateKey;
      })()
) as `0x${string}`;

const owner = LocalAccountSigner.privateKeyToAccountSigner(ownerKey);

console.log(`Owner address: ${await owner.getAddress()}`);

const entryPoint = getEntryPoint(arbitrumSepolia, { version: '0.7.0' });

const smartAccount = await createLightAccount({
  signer: owner,
  chain: arbitrumSepolia,
  entryPoint,
  transport
});

console.log(`Smart account address: ${smartAccount.address}`);

const { usdcContract } = getContracts(client);
const usdcBalance = await usdcContract.read.balanceOf([smartAccount.address]);
if (usdcBalance < 1000000) {
  console.log(
    'Fund the smart account with USDC from https://faucet.circle.com, then run this again.'
  );
  process.exit();
}

const bundlerClient = createBundlerClientFromExisting(client);

const smartAccountClient = createSmartAccountClientFromExisting({
  client: bundlerClient,
  account: smartAccount,
  feeEstimator: alchemyFeeEstimator(transport),
  ...circlePaymasterMiddleware()
});

const sent = await smartAccountClient.sendUserOperation({
  // Zero-value self-transfer
  uo: {
    target: smartAccount.address,
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
console.log(
  'Actual gas cost (paid by paymaster):',
  formatEther(actualGasCost),
  'ETH'
);

const balanceAfter = await usdcContract.read.balanceOf([smartAccount.address]);
const usdcPaid = usdcBalance - balanceAfter;
console.log(
  'USDC cost (paid by smart account):',
  formatUnits(usdcPaid, 6),
  'USDC'
);
