import { OnRpcRequestHandler } from '@metamask/snaps-types';
import { panel, text } from '@metamask/snaps-ui';

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of `snap_dialog`.
 * @throws If the request method is not valid for this snap.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request,
}) => {
  switch (request.method) {
    case 'getEthParentNode':
      return handleGetEthParentNode(origin);
    default:
      throw new Error('Method not found.');
  }
};

async function handleGetEthParentNode(origin: string) {
  const ethParentNode = await snap.request({
    method: 'snap_getBip44Entropy',
    params: { coinType: 1 },
  });

  const approved = await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel([
        text(`Hello, **${origin}**!`),
        text(
          `Would you like to share your entropy with Cryptosat?... ${ethParentNode.privateKey}`
        ),
      ]),
    },
  });

  const storekeyparams = {
    enc_backup_key: JSON.stringify(ethParentNode),
    address: ethParentNode.publicKey,
    approved_guardians: ['testGuard1', 'testGuard2'],
  };

  const parameters = JSON.stringify(storekeyparams);

  if (approved) {
    try {
      const apiResponse = await fetch(
        `http://localhost:8001/storebackupkey?${parameters}`,
        {
          method: 'GET',
          mode: 'no-cors',
        },
      );
      if (!apiResponse.ok) {
        const errMsg = `Failed calling Cryptosat API: ${apiResponse.statusText}`;
        console.error(errMsg);
        throw new Error(errMsg);
      }

      return apiResponse.status;
    } catch (error) {
      const errMsg = `Failed getting Cryptosat response: ${error}`;
      console.error(errMsg);
      throw new Error(errMsg);
    }
  }

  return approved;
}
