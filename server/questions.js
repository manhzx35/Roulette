// Bộ câu hỏi chỉ nằm ở server: client không bao giờ nhận được đáp án trước khi trả lời.
// answer = chỉ số đáp án đúng trong options (0 = A, 1 = B, 2 = C, 3 = D).
export const QUESTIONS = [
  {
    text: 'Theo chủ nghĩa Mác – Lênin, tôn giáo là:',
    options: [
      'Một hiện tượng xã hội ra đời rất sớm, tồn tại phổ biến ở hầu hết các cộng đồng người',
      'Một hiện tượng chỉ xuất hiện trong xã hội tư bản chủ nghĩa',
      'Một hình thức tổ chức nhà nước của giai cấp thống trị',
      'Một hiện tượng tự nhiên không phụ thuộc vào con người',
    ],
    answer: 0,
  },
  {
    text: 'Tôn giáo bao gồm những yếu tố nào?',
    options: [
      'Giáo lý, giáo luật, giáo hội',
      'Ý thức tôn giáo, hệ thống tổ chức tôn giáo, hoạt động nghi thức',
      'Tín đồ, chức sắc, nơi thờ tự',
      'Niềm tin, lễ hội, phong tục',
    ],
    answer: 1,
  },
  {
    text: 'Tôn giáo có mấy nguồn gốc?',
    options: ['2', '3', '4', '5'],
    answer: 1,
  },
  {
    text: 'Nguồn gốc nào là nguyên nhân sâu xa của tôn giáo?',
    options: [
      'Nguồn gốc tâm lý',
      'Nguồn gốc nhận thức',
      'Nguồn gốc tự nhiên, kinh tế – xã hội',
      'Nguồn gốc văn hóa',
    ],
    answer: 2,
  },
  {
    text: 'Sự bất lực của con người trước các thế lực tự nhiên, dẫn đến gán cho tự nhiên sức mạnh thần bí, thuộc nguồn gốc nào?',
    options: ['Nguồn gốc tự nhiên', 'Nguồn gốc tâm lý', 'Nguồn gốc nhận thức', 'Nguồn gốc chính trị'],
    answer: 0,
  },
  {
    text: 'Con người không giải thích được sự phân chia giai cấp, bóc lột, bất công nên trông chờ vào lực lượng siêu nhiên. Đây là nguồn gốc:',
    options: ['Nhận thức', 'Kinh tế – xã hội', 'Tâm lý', 'Văn hóa'],
    answer: 1,
  },
  {
    text: 'Nhận định nào sau đây thuộc nguồn gốc nhận thức của tôn giáo?',
    options: [
      'Lòng biết ơn, kính trọng tổ tiên',
      'Nỗi sợ hãi trước thế lực thống trị',
      'Nhận thức của con người về tự nhiên, xã hội và bản thân còn giới hạn',
      'Sự bất lực trước thiên tai',
    ],
    answer: 2,
  },
  {
    text: 'Nguồn gốc tâm lý của tôn giáo bao gồm:',
    options: [
      'Chỉ các trạng thái tâm lý tiêu cực',
      'Chỉ các trạng thái tâm lý tích cực',
      'Cả trạng thái tâm lý tiêu cực và tích cực',
      'Tâm lý đám đông và tâm lý giai cấp',
    ],
    answer: 2,
  },
  {
    text: 'Tôn giáo có những tính chất nào?',
    options: [
      'Tính lịch sử, tính quần chúng, tính chính trị',
      'Tính giai cấp, tính dân tộc, tính quốc tế',
      'Tính lịch sử, tính dân tộc, tính nhân văn',
      'Tính quần chúng, tính khoa học, tính chính trị',
    ],
    answer: 0,
  },
  {
    text: 'Tôn giáo hình thành, tồn tại, biến đổi qua các giai đoạn để thích nghi với nhiều chế độ chính trị – xã hội. Đây là tính chất:',
    options: ['Tính quần chúng', 'Tính lịch sử', 'Tính chính trị', 'Tính dân tộc'],
    answer: 1,
  },
  {
    text: 'Biểu hiện nào KHÔNG thuộc tính quần chúng của tôn giáo?',
    options: [
      'Tôn giáo phổ biến ở nhiều quốc gia, châu lục',
      'Số lượng tín đồ đông đảo',
      'Là nơi sinh hoạt văn hóa, tinh thần của một bộ phận nhân dân',
      'Bị giai cấp bóc lột sử dụng để phục vụ lợi ích giai cấp',
    ],
    answer: 3,
  },
  {
    text: 'Tính chính trị của tôn giáo xuất hiện khi nào?',
    options: [
      'Ngay từ khi tôn giáo ra đời',
      'Khi xã hội có phân chia giai cấp, đối kháng giai cấp',
      'Khi chủ nghĩa tư bản ra đời',
      'Khi nhà nước xã hội chủ nghĩa được thành lập',
    ],
    answer: 1,
  },
  {
    text: 'Nhà nước XHCN phải tôn trọng và bảo đảm quyền gì của mọi công dân?',
    options: [
      'Quyền tự do truyền đạo không giới hạn',
      'Quyền tự do tín ngưỡng và không tín ngưỡng',
      'Quyền theo một tôn giáo chính thống duy nhất',
      'Quyền tự do tín ngưỡng nhưng không có quyền không tín ngưỡng',
    ],
    answer: 1,
  },
  {
    text: 'Khắc phục dần những ảnh hưởng tiêu cực của tôn giáo phải gắn liền với:',
    options: [
      'Việc cấm hoạt động tôn giáo',
      'Quá trình cải tạo xã hội cũ, xây dựng xã hội mới',
      'Việc giảm số lượng tín đồ',
      'Việc hợp nhất các tôn giáo',
    ],
    answer: 1,
  },
  {
    text: 'Trong vấn đề tôn giáo, mặt nào phải đấu tranh loại bỏ?',
    options: [
      'Mặt tư tưởng (sự tín ngưỡng)',
      'Mặt văn hóa',
      'Mặt chính trị phản động (lợi dụng tôn giáo chống phá cách mạng)',
      'Cả mặt chính trị và mặt tư tưởng',
    ],
    answer: 2,
  },
  {
    text: 'Khi giải quyết các vấn đề tôn giáo cần có quan điểm:',
    options: ['Toàn diện – phát triển', 'Lịch sử – cụ thể', 'Thực tiễn – khách quan', 'Giai cấp – dân tộc'],
    answer: 1,
  },
  {
    text: 'Đặc điểm nào đúng với tôn giáo ở Việt Nam?',
    options: [
      'Chỉ có một tôn giáo chính',
      'Thường xuyên xảy ra chiến tranh tôn giáo',
      'Đa dạng, đan xen, chung sống hòa bình, không có xung đột, chiến tranh tôn giáo',
      'Các tôn giáo không có quan hệ với tổ chức tôn giáo nước ngoài',
    ],
    answer: 2,
  },
  {
    text: 'Tín đồ các tôn giáo ở Việt Nam chủ yếu là:',
    options: [
      'Tầng lớp trí thức',
      'Nhân dân lao động, có lòng yêu nước, tinh thần dân tộc',
      'Giới doanh nhân',
      'Người nước ngoài sinh sống tại Việt Nam',
    ],
    answer: 1,
  },
  {
    text: 'Nội dung cốt lõi của công tác tôn giáo là:',
    options: [
      'Công tác vận động quần chúng',
      'Công tác quản lý nhà nước về tôn giáo',
      'Công tác tuyên truyền vô thần',
      'Công tác đào tạo chức sắc',
    ],
    answer: 0,
  },
  {
    text: 'Các thế lực thù địch thường lợi dụng vấn đề dân tộc và tôn giáo nhằm:',
    options: [
      'Thúc đẩy hội nhập quốc tế',
      'Phát triển kinh tế vùng dân tộc thiểu số',
      'Thực hiện âm mưu “diễn biến hòa bình”',
      'Bảo tồn văn hóa truyền thống',
    ],
    answer: 2,
  },
  {
    text: 'Theo chính sách của Đảng, Nhà nước, công tác tôn giáo là trách nhiệm của:',
    options: [
      'Riêng Ban Tôn giáo Chính phủ',
      'Các chức sắc tôn giáo',
      'Cả hệ thống chính trị',
      'Mặt trận Tổ quốc Việt Nam',
    ],
    answer: 2,
  },
];
