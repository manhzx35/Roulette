// Bộ câu hỏi chỉ nằm ở server: client không bao giờ nhận được đáp án trước khi trả lời.
// answer = chỉ số đáp án đúng trong options (0 = A, 1 = B, 2 = C, 3 = D).
// Chủ đề: tư tưởng Hồ Chí Minh về văn hóa và đạo đức.
export const QUESTIONS = [
  // ---------- Văn hóa ----------
  {
    text: 'Theo quan điểm của Hồ Chí Minh, văn hóa đóng vai trò là động lực thúc đẩy cách mạng thông qua vai trò cốt lõi nào?',
    options: [
      'Soi đường cho quốc dân đi',
      'Giải phóng các dân tộc trên thế giới',
      'Tạo ra của cải vật chất cho xã hội',
      'Thay thế cho các lĩnh vực kinh tế và chính trị',
    ],
    answer: 0,
  },
  {
    text: 'Khi khẳng định “Văn hóa là một mặt trận”, Hồ Chí Minh xếp vị trí của văn hóa như thế nào trong đời sống kinh tế – xã hội?',
    options: [
      'Đứng trên chính trị và kinh tế',
      'Ngang hàng và có tác động qua lại chặt chẽ với các lĩnh vực kinh tế, chính trị, xã hội',
      'Là lĩnh vực phụ thuộc hoàn toàn vào sự phát triển của kinh tế',
      'Là lĩnh vực hoàn toàn biệt lập, không liên quan đến các lĩnh vực khác',
    ],
    answer: 1,
  },
  {
    text: 'Nhà văn hóa, người làm công tác tuyên truyền khi sáng tác phải trả lời rõ 4 câu hỏi cốt lõi nào theo chỉ dẫn của Chủ tịch Hồ Chí Minh?',
    options: [
      'Viết cái gì? Viết ở đâu? Khi nào viết? Viết bao lâu?',
      'Viết cho ai? Mục đích viết? Lấy tài liệu đâu mà viết? Cách viết như thế nào?',
      'Viết bao nhiêu trang? Viết bằng ngôn ngữ gì? Ai xuất bản? Giá bán bao nhiêu?',
      'Viết về ai? Viết nhằm mục đích gì? Viết trong thời gian nào? Ai khen thưởng?',
    ],
    answer: 1,
  },
  {
    text: 'Trong thời kỳ kháng chiến chống Pháp, nền văn hóa mới được khẳng định xây dựng dựa trên 3 tính chất nào?',
    options: [
      'Dân tộc, khoa học và đại chúng',
      'Hiện đại, tiến bộ và nhân văn',
      'Xã hội chủ nghĩa, dân tộc và truyền thống',
      'Tự cường, dân chủ và pháp quyền',
    ],
    answer: 0,
  },
  {
    text: 'Tháng 8/1943 (trước Cách mạng Tháng Tám), Hồ Chí Minh đã đề ra mấy nội dung xây dựng nền văn hóa dân tộc và nội dung nào thuộc về “Xây dựng tâm lý”?',
    options: [
      '3 nội dung – Tinh thần hy sinh vì quần chúng',
      '4 nội dung – Thực hiện dân quyền cho nhân dân',
      '5 nội dung – Tinh thần độc lập tự cường',
      '6 nội dung – Nâng cao phúc lợi cho nhân dân',
    ],
    answer: 2,
  },

  // ---------- Đạo đức qua tình huống ----------
  {
    text: 'Một cán bộ có chuyên môn giỏi nhưng thường ưu tiên giải quyết công việc cho người quen. Tình huống này cho thấy rõ nhất điều gì trong tư tưởng Hồ Chí Minh?',
    options: [
      'Chuyên môn là yếu tố duy nhất quyết định uy tín của cán bộ',
      'Đạo đức là nền tảng định hướng việc sử dụng năng lực và quyền hạn',
      'Uy tín của cán bộ chủ yếu được quyết định bởi chức vụ',
      'Quan hệ cá nhân có thể thay thế trách nhiệm phục vụ nhân dân',
    ],
    answer: 1,
  },
  {
    text: 'Sau khi nhóm đạt giải cao, trưởng nhóm vẫn ghi nhận đóng góp của từng thành viên và chủ động học hỏi. Hành động này thể hiện quan điểm nào của Hồ Chí Minh?',
    options: [
      'Đạo đức chủ yếu cần thiết khi con người gặp thất bại',
      'Thành công là căn cứ để khẳng định một người luôn có đạo đức',
      'Khi thành công, người lãnh đạo không còn cần rèn luyện bản thân',
      'Khi thành công, con người vẫn phải giữ sự khiêm tốn, tránh tự mãn',
    ],
    answer: 3,
  },
  {
    text: 'Một sinh viên muốn xây dựng ứng dụng giúp người cao tuổi nhưng chưa đủ kiến thức để bảo đảm ứng dụng hoạt động an toàn. Cách lựa chọn nào phù hợp nhất với yêu cầu vừa “hồng” vừa “chuyên”?',
    options: [
      'Tiếp tục học chuyên môn, kiểm thử cẩn thận và giữ mục tiêu phục vụ người dùng',
      'Đưa ứng dụng vào sử dụng ngay vì mục đích tốt có thể bù đắp hạn chế kỹ thuật',
      'Tập trung quảng bá ý nghĩa nhân văn trước khi giải quyết những lỗi đã phát hiện',
      'Chỉ nâng cao kỹ thuật, không cần quan tâm đến nhu cầu thực tế của người dùng',
    ],
    answer: 0,
  },
  {
    text: 'Trong câu chuyện góp gạo cứu đói năm 1945, vì sao việc Hồ Chí Minh tự mình đóng góp có sức thuyết phục đối với nhân dân?',
    options: [
      'Vì lời kêu gọi của người có chức vụ luôn đủ để tạo niềm tin',
      'Vì sự đóng góp của một cá nhân có thể giải quyết toàn bộ nạn đói',
      'Vì Người thực hiện lời kêu gọi bằng hành động và chia sẻ khó khăn với nhân dân',
      'Vì giá trị của hoạt động cứu đói chủ yếu nằm ở khả năng tuyên truyền',
    ],
    answer: 2,
  },
  {
    text: 'Một cơ quan treo khẩu hiệu “Tận tâm phục vụ nhân dân”. Theo nội dung bài thuyết trình, điều gì giúp khẩu hiệu ấy thực sự tạo dựng niềm tin?',
    options: [
      'Khẩu hiệu được đặt ở vị trí nổi bật, dễ quan sát',
      'Cán bộ hướng dẫn tận tình, giải quyết công việc công bằng và có trách nhiệm',
      'Cơ quan thường xuyên giới thiệu thành tích phục vụ của mình',
      'Cán bộ yêu cầu người dân tin tưởng trước khi giải quyết công việc',
    ],
    answer: 1,
  },

  // ---------- Cần, kiệm, liêm, chính ----------
  {
    text: 'Theo Hồ Chí Minh, phẩm chất đạo đức nào giữ vị trí bao trùm, quan trọng nhất và chi phối các phẩm chất đạo đức khác?',
    options: [
      'Cần, kiệm, liêm, chính',
      'Trung với nước, hiếu với dân',
      'Thương yêu con người, sống có tình có nghĩa',
      'Tinh thần quốc tế trong sáng',
    ],
    answer: 1,
  },
  {
    text: 'Hồ Chí Minh đã so sánh bốn đức tính “Cần, Kiệm, Liêm, Chính” với hiện tượng tự nhiên nào?',
    options: [
      'Bốn hướng của gió và bốn nguyên tố vũ trụ',
      'Bốn dòng sông lớn và bốn ngọn núi cao',
      'Bốn mùa của trời, bốn phương của đất',
      'Bốn thời kỳ phát triển của lịch sử',
    ],
    answer: 2,
  },
  {
    text: 'Theo Hồ Chí Minh, để việc thực hành đức tính “Cần” đạt được nhiều kết quả cao hơn, con người nhất thiết phải có yếu tố gì?',
    options: [
      'Phải có người quản lý giám sát chặt chẽ',
      'Phải có kế hoạch cho mọi công việc',
      'Phải có chức vụ và địa vị cao',
      'Phải làm việc liên tục không nghỉ ngơi',
    ],
    answer: 1,
  },
  {
    text: 'Mối quan hệ giữa hai đức tính “Liêm” và “Kiệm” được Hồ Chí Minh giải thích như thế nào?',
    options: [
      'Liêm và Kiệm hoàn toàn độc lập, không liên quan đến nhau',
      'Chỉ cần giữ chữ Liêm thì tự khắc sẽ có chữ Kiệm',
      'Chữ Liêm phải đi đôi với chữ Kiệm, có Kiệm mới Liêm được',
      'Kiệm là kết quả tự nhiên sau khi đã đạt được Liêm',
    ],
    answer: 2,
  },
  {
    text: 'Theo tư tưởng Hồ Chí Minh, bản chất của “Chí công vô tư” có mối quan hệ như thế nào đối với các đức tính “Cần, Kiệm, Liêm, Chính”?',
    options: [
      'Bị tách rời hoàn toàn khỏi Cần, Kiệm, Liêm, Chính',
      'Thực chất là sự tiếp nối của Cần, Kiệm, Liêm, Chính',
      'Thay thế hoàn toàn cho bốn đức tính Cần, Kiệm, Liêm, Chính',
      'Là tiền đề duy nhất sinh ra Cần, Kiệm, Liêm, Chính',
    ],
    answer: 1,
  },

  // ---------- Xây đi đôi với chống, tu dưỡng đạo đức ----------
  {
    text: 'Trong nguyên tắc “Xây đi đôi với chống”, Hồ Chí Minh xác định phương châm chỉ đạo cốt lõi nào sau đây?',
    options: [
      'Lấy “chống” làm chính, “xây” là phụ',
      '“Chống” nhằm mục đích “xây” và lấy “xây” làm chính',
      '“Xây” và “chống” là hai quá trình độc lập, không liên quan đến nhau',
      'Chỉ tập trung “xây” các giá trị mới mà không cần “chống” cái xấu',
    ],
    answer: 1,
  },
  {
    text: 'Trong tác phẩm “Nâng cao đạo đức cách mạng, quét sạch chủ nghĩa cá nhân” (1969), Hồ Chí Minh đưa ra lưu ý quan trọng nào khi đấu tranh chống chủ nghĩa cá nhân?',
    options: [
      'Đấu tranh chống chủ nghĩa cá nhân đồng nghĩa với việc tiêu diệt triệt để lợi ích cá nhân',
      'Đấu tranh chống chủ nghĩa cá nhân không phải là “giày xéo lên lợi ích cá nhân”',
      'Lợi ích cá nhân hoàn toàn đối lập với lợi ích tập thể trong chủ nghĩa xã hội',
      'Chỉ cần chống chủ nghĩa cá nhân ở cấp lãnh đạo, không cần ở quần chúng',
    ],
    answer: 1,
  },
  {
    text: 'Khi vận dụng luận điểm “chính tâm, tu thân” của Khổng Tử vào đạo đức cách mạng, Hồ Chí Minh chỉ ra bản chất của việc “chính tâm tu thân” là gì?',
    options: [
      'Là tiếp thu nguyên vẹn các chuẩn mực đạo đức phong kiến',
      'Là khép mình vào các khuôn phép lễ nghi cổ xưa',
      'Là “cải tạo” – cuộc cách mạng trong bản thân mỗi người để bồi dưỡng tư tưởng mới và đoạn tuyệt với con người cũ',
      'Là phương pháp tu luyện tâm tính chỉ dành riêng cho cán bộ có chức có quyền',
    ],
    answer: 2,
  },
  {
    text: 'Chọn phương án đúng nhất điền vào chỗ trống trong trích dẫn sau của Hồ Chí Minh: “Đạo đức cách mạng không phải trên trời sa xuống. Nó do đấu tranh, rèn luyện bền bỉ hằng ngày mà phát triển và củng cố. Cũng như…”',
    options: [
      'nước chảy đá mòn, tre già măng mọc',
      'ngọc càng mài càng sáng, vàng càng luyện càng trong',
      'lúa gặp mưa xuân, hoa nở mùa hạ',
      'cây có gốc mới nở cành xanh lá, sông có nguồn mới có biển rộng sông sâu',
    ],
    answer: 1,
  },
  {
    text: 'Theo Hồ Chí Minh, vì sao việc tu dưỡng đạo đức cách mạng phải tiến hành liên tục, kiên trì suốt đời?',
    options: [
      'Vì đạo đức cách mạng là cái “nhất thành bất biến”, được hình thành một lần là duy trì mãi mãi',
      'Vì nếu không kiên trì rèn luyện thì người có công ở thời kỳ trước vẫn có thể thành người có lỗi ở thời kỳ sau, lúc trẻ giữ được đạo đức nhưng lúc già lại thoái hóa, biến chất',
      'Vì pháp luật chỉ xử lý các hành vi vi phạm đạo đức của người còn trẻ',
      'Vì môi trường xã hội chỉ tác động đến sự hình thành đạo đức của con người trong thời niên thiếu',
    ],
    answer: 1,
  },
];
