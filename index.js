const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/law", async (req, res) => {
  const { id, article } = req.query;

  if (!id || !article) {
    return res.status(400).json({ error: "법령ID(id)와 조문번호(article)를 입력하세요." });
  }

  try {
    const url = `https://www.law.go.kr/DRF/lawService.do?OC=nexpw&target=law&type=json&ID=${id}`;
    const response = await axios.get(url);

    const lawData = response.data?.Law;
    const clause = lawData?.조문?.find(c => c.조문번호 === article.toString());

    if (!clause) {
      return res.status(404).json({ error: `조문번호 ${article}번을 찾을 수 없습니다.` });
    }

    res.json({
      법령명: lawData.법령명한글 || "알 수 없음",
      조문번호: clause.조문번호,
      조문제목: clause.조문제목,
      조문내용: clause.조문내용
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "법령 정보 가져오기 실패" });
  }
});

app.get("/", (req, res) => {
  res.send("✅ 국가법령 프록시 서버 실행 중!");
});

app.listen(PORT, () => {
  console.log(`✅ 서버가 포트 ${PORT}에서 실행 중`);
});
