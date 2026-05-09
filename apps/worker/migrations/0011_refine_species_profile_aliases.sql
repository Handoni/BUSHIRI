UPDATE species_profiles
SET aliases = CASE canonical_name
  WHEN '광어' THEN '넙치'
  WHEN '참돔' THEN '도미'
  WHEN '감성돔' THEN '감생이'
  WHEN '돌도다리' THEN ''
  WHEN '능성어' THEN '구문쟁이'
  WHEN '농어' THEN ''
  WHEN '자바리' THEN '다금바리'
  WHEN '점성어' THEN '홍민어'
  WHEN '시마아지' THEN '흑점줄전갱이'
  WHEN '줄돔' THEN '이시가키다이'
  WHEN '돌돔' THEN '시마다이'
  WHEN '잿방어' THEN '간파치'
  WHEN '부시리' THEN '히라스'
  WHEN '연어' THEN ''
  WHEN '개숭어' THEN '가숭어, 참숭어, 밀치'
  WHEN '도다리' THEN '문치가자미, 담배쟁이'
  WHEN '도미' THEN ''
  WHEN '방어' THEN ''
  WHEN '뱅에돔' THEN '벵에돔'
  WHEN '보리숭어' THEN ''
  WHEN '복어' THEN ''
  WHEN '붉바리' THEN '아까바리'
  WHEN '숭어' THEN ''
  WHEN '우럭' THEN '조피볼락'
  WHEN '참복' THEN '자주복'
  ELSE aliases
END,
updated_at = CURRENT_TIMESTAMP
WHERE category IN ('fish', 'salmon');
