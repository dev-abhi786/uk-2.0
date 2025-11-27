const { getMux, getIntegrationSdk } = require('../api-util/sdk');

const mux = getMux();

const marketplaceUrl = process.env.REACT_APP_MARKETPLACE_ROOT_URL;

const getMuxUploadUrl = async (req, res) => {
  try {
    const { txId } = req.query;
    const upload = await mux.video.uploads.create({
      // Set the CORS origin to your application.
      cors_origin: marketplaceUrl,
      new_asset_settings: {
        playback_policy: ['public'],
        static_renditions: [
          {
            resolution: 'highest',
          },
        ],
        meta: {
          title: 'master',
          external_id: txId,
        },
      },
    });

    res.status(200).json(upload);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get mux upload url' + JSON.stringify(error),
    });
  }
};

const getMuxUploadUrlWatermark = async (req, res) => {
  try {
    const { txId } = req.query;
    const upload = await mux.video.uploads.create({
      // Set the CORS origin to your application.
      cors_origin: marketplaceUrl,
      new_asset_settings: {
        meta: {
          title: 'child',
          external_id: txId,
        },
        playback_policy: ['public'],
        inputs: [
          {
            url: marketplaceUrl.includes('staging')
              ? 'https://muxed.s3.amazonaws.com/example-watermark.png'
              : `${marketplaceUrl}/static/images/watermark.jpg`,
            overlay_settings: {
              vertical_align: 'middle',
              horizontal_align: 'center',
              opacity: '90%',
              width: '30%',
            },
          },
        ],
      },
    });

    res.status(200).json({ ...upload, isWaterMarked: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get mux upload url' + JSON.stringify(error) });
  }
};

const getMuxAsset = async (req, res) => {
  try {
    const { uploadId, txId } = req.query;
    const uploadRes = await mux.video.uploads.retrieve(uploadId);

    const { external_id, title } = uploadRes.new_asset_settings.meta;

    if (title === 'master') {
      if (external_id !== txId) {
        return res.status(400).json({ error: 'Invalid Operation: TxId does not match' });
      }

      const iSdk = getIntegrationSdk();
      const txRes = await iSdk.transactions.show({ id: txId, include: ['customer'] });

      if (
        ![
          'transition/submit-service-after-problem-fix',
          'transition/submit-service',
          'transition/customer-report-a-problem',
        ].includes(txRes?.data.data.attributes.lastTransition)
      ) {
        return res.status(400).json({ error: 'Invalid Operation: Not allowed' });
      }

      if (req.tokenUserId !== txRes?.data.included[0].id.uuid) {
        return res
          .status(403)
          .json({ error: 'Forbidden: You are not allowed to perform this action' });
      }
    }
    const assetRes = await mux.video.assets.retrieve(uploadRes.asset_id);

    res.status(200).json({
      playback_id: assetRes.playback_ids[0].id,
      asset_id: assetRes.id,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get mux asset' });
  }
};

const deleteMuxAsset = async (req, res) => {
  try {
    const { assetId } = req.body;
    await mux.video.assets.delete(assetId);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete mux asset' });
  }
};

module.exports = {
  getMuxUploadUrl,
  getMuxUploadUrlWatermark,
  getMuxAsset,
  // deleteMuxAsset,
};
