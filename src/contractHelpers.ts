import { getContract, type Client } from 'viem';
import { ChainNotFoundError } from '@aa-sdk/core';
import { circlePaymasterAddresses, usdcAddresses } from './addresses.js';
import { eip2612Abi } from './permitHelpers.js';

export const paymasterAbi = [
  {
    inputs: [],
    stateMutability: 'view',
    type: 'function',
    name: 'additionalGasCharge',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256'
      }
    ]
  }
] as const;

export const getContracts = (client: Client) => {
  if (!client.chain) throw new ChainNotFoundError();

  const usdcContract = getContract({
    client,
    address: usdcAddresses[client.chain.id],
    abi: eip2612Abi
  });

  const paymasterContract = getContract({
    client,
    address: circlePaymasterAddresses[client.chain.id],
    abi: paymasterAbi
  });

  return { usdcContract, paymasterContract };
};
