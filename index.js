app.get("/law-text", async (req, res) => {
  const lawId = req.query.id;
  const field = req.query.field;

  if (!lawId || !field) {
    return res.status(400).json({ error: "id와 field 쿼리 파라미터가 필요합니다." });
  }

  try {
    const url = `https://www.law.go.kr/DRF/lawService.do?OC=nexpw&target=law&type=json&ID=${lawId}`;
    const response = await axios.get(url);
    const data = response.data;
    const lawData = data.Law || data.법령 || {};

    const result = lawData[field];

    if (!result) {
      return res.status(404).json({ error: `${field} 필드를 찾을 수 없습니다.` });
    }

    return res.json({ [field]: result });
  } catch (error) {
    return res.status(500).json({ error: "조회 실패", detail: error.message });
  }
});
