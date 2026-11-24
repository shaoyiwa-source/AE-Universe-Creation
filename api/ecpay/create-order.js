'use strict';
// Keep the original paid endpoint behavior unchanged. The buyer-facing
// route is an explicitly marked branch so the Hobby function count stays at 12.
module.exports = function dispatch(req,res) {
  const mode = req.query?.route;
  if (mode === 'auto') return require('../_buy')(req,res);
  return require('./_create-order')(req,res);
};
