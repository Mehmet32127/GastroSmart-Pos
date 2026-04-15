function ok(res, data, message, status = 200) {
  return res.status(status).json({ success: true, data, message })
}

function fail(res, error, status = 400) {
  return res.status(status).json({ success: false, error })
}

function paginate(res, data, total, page, limit) {
  return res.json({
    success: true,
    data,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

module.exports = { ok, fail, paginate }
