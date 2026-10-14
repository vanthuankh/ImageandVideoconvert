import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageOrientation,
} from 'docx';
import { MediaItem, ProductInfo, SpecCheckResult } from '../types';

export interface DocGenerationOptions {
  productInfo: ProductInfo;
  items: MediaItem[];
  specCheck?: SpecCheckResult;
  featuredFileName?: string;
  totalOriginalSizeMB: number;
  totalExportedSizeMB: number;
}

export async function generateWordDocument(options: DocGenerationOptions): Promise<Blob> {
  const {
    productInfo,
    items,
    specCheck,
    featuredFileName,
    totalOriginalSizeMB,
    totalExportedSizeMB,
  } = options;

  const todayStr = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());

  const activeItems = items.filter((it) => !it.isSkipped);
  const imageCount = activeItems.filter((it) => it.mediaType === 'image' || it.isShortStaticVideo).length;
  const videoCount = activeItems.filter((it) => it.mediaType === 'video' && !it.isShortStaticVideo).length;

  const savingsPercent = totalOriginalSizeMB > 0
    ? Math.max(0, Math.round(((totalOriginalSizeMB - totalExportedSizeMB) / totalOriginalSizeMB) * 100))
    : 0;

  // Collect all warnings
  const allWarnings: string[] = [];
  activeItems.forEach((it) => {
    if (it.aiResult?.canh_bao && it.aiResult.canh_bao.length > 0) {
      it.aiResult.canh_bao.forEach((w) => {
        const line = `[${it.originalName}] ${w}`;
        if (!allWarnings.includes(line)) allWarnings.push(line);
      });
    }
  });

  // Table rows for 3-column table
  // Column 1: Ảnh gốc (tên không đuôi; video ghi thêm "(video)")
  // Column 2: Tên file mới (đầy đủ, có đuôi)
  // Column 3: Alt text
  const tableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 28, type: WidthType.PERCENTAGE },
          shading: { fill: 'E5E7EB' }, // Light gray background
          margins: { top: 120, bottom: 120, left: 140, right: 140 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [new TextRun({ text: 'Ảnh gốc', bold: true, font: 'Arial', size: 20 })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 36, type: WidthType.PERCENTAGE },
          shading: { fill: 'E5E7EB' },
          margins: { top: 120, bottom: 120, left: 140, right: 140 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [new TextRun({ text: 'Tên file mới', bold: true, font: 'Arial', size: 20 })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 36, type: WidthType.PERCENTAGE },
          shading: { fill: 'E5E7EB' },
          margins: { top: 120, bottom: 120, left: 140, right: 140 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [new TextRun({ text: 'Alt text', bold: true, font: 'Arial', size: 20 })],
            }),
          ],
        }),
      ],
    }),
  ];

  for (const item of activeItems) {
    // Strip file extension from originalName
    const lastDotIndex = item.originalName.lastIndexOf('.');
    const rawBaseName = lastDotIndex > 0 ? item.originalName.substring(0, lastDotIndex) : item.originalName;
    const isVideo = item.mediaType === 'video' && !itIsStatic(item);
    const col1Text = isVideo ? `${rawBaseName} (video)` : rawBaseName;

    const newExt = isVideo ? '.gif' : '.webp';
    const finalSuffix = (item.editedSuffix || item.aiResult?.hau_to || 'goc-nghieng-mat-truoc').trim();
    const col2Text = `${productInfo.filePrefix}${finalSuffix}${newExt}`;
    
    // Strict alt: if empty, generate guaranteed factual visual description with modelCode
    let col3Text = (item.editedAlt || item.aiResult?.alt || '').trim();
    if (!col3Text) {
      col3Text = isVideo
        ? `Ảnh động thao tác thiết bị ${productInfo.modelCode}`
        : `Mặt ngoài thiết bị ${productInfo.modelCode}`;
    }

    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: col1Text, font: 'Arial', size: 19 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 36, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: col2Text,
                    font: 'Arial',
                    size: 19,
                    color: item.isFeatured ? '1E40AF' : '111827',
                    bold: item.isFeatured,
                  }),
                  ...(item.isFeatured
                    ? [new TextRun({ text: ' (Đại diện)', font: 'Arial', size: 17, color: 'DC2626', italics: true })]
                    : []),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 36, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: col3Text, font: 'Arial', size: 19 })],
              }),
            ],
          }),
        ],
      })
    );
  }

  // Children paragraphs of the document
  const docChildren: any[] = [
    // 1. Tiêu đề
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [
        new TextRun({
          text: `Diễn giải hình ảnh – ${productInfo.productName}`,
          font: 'Arial',
          size: 32, // 16pt
          bold: true,
          color: '1E3A8A', // Dark Navy
        }),
      ],
    }),

    // 2. Thông tin chung
    createHeading('2. THÔNG TIN CHUNG'),
    createInfoLine('Sản phẩm:', productInfo.productName),
    createInfoLine('Mã model:', productInfo.modelCode),
    createInfoLine('Thư mục gốc:', productInfo.folderName || 'Thư mục ảnh sản phẩm'),
    createInfoLine('Ngày xử lý:', todayStr),
    createInfoLine('Tiền tố tên file:', productInfo.filePrefix),
    new Paragraph({ spacing: { after: 180 } }),

    // 3. Quá trình xử lý
    createHeading('3. QUÁ TRÌNH XỬ LÝ'),
    createBulletPoint(
      `Tổng số lượng tệp: ${activeItems.length} tệp (gồm ${imageCount} ảnh tĩnh và ${videoCount} video clip).`
    ),
    createBulletPoint(
      `Ảnh tĩnh nén sang WebP: quality 82, chiều rộng tối đa 1200px, giữ nguyên nền trong suốt (PNG/WebP). Tổng dung lượng trước: ${totalOriginalSizeMB.toFixed(2)} MB → sau: ${totalExportedSizeMB.toFixed(2)} MB (giảm khoảng ${savingsPercent}%).`
    ),
  ];

  // Video gif details bullet
  if (videoCount > 0) {
    const videoDetails = activeItems
      .filter((it) => it.mediaType === 'video' && !itIsStatic(it))
      .map((it) => `${it.originalName}: ${it.gifTierInfo || 'GIF tối ưu dưới 3.9 MB'} (~${((it.exportedSize || 0) / (1024 * 1024)).toFixed(2)} MB)`)
      .join('; ');
    docChildren.push(
      createBulletPoint(
        `Video chuyển sang ảnh động GIF: mỗi file đảm bảo dưới 3.9 MB (giới hạn CMS 4 MB), không âm thanh, lặp vô hạn. Chi tiết: ${videoDetails}.`
      )
    );
  }

  docChildren.push(
    createBulletPoint('Ảnh/video gốc giữ nguyên (tất cả file gốc trong thư mục không bị đổi tên hay thay đổi nội dung).'),
    new Paragraph({ spacing: { after: 200 } })
  );

  // 4. Bảng danh sách
  docChildren.push(
    createHeading('4. BẢNG DANH SÁCH FILE VÀ ALT TEXT'),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: 'Thứ tự ưu tiên: Ảnh sản phẩm góc máy → Video/Ảnh động GIF → Ảnh thông tin & banner tính năng.',
          font: 'Arial',
          size: 18,
          italics: true,
          color: '4B5563',
        }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
        left: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
        right: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
        insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' },
      },
      rows: tableRows,
    }),
    new Paragraph({ spacing: { after: 240 } })
  );

  // 5. Ghi chú
  docChildren.push(
    createHeading('5. GHI CHÚ VÀ HƯỚNG DẪN ĐĂNG BÀI'),
    createBulletPoint(
      `Ảnh đại diện đề xuất: ${featuredFileName || 'Ảnh góc nghiêng mặt trước của sản phẩm'}.`
    ),
    createBulletPoint(
      'Quy tắc hiển thị website: Gallery sản phẩm chỉ đăng ảnh các góc máy thiết bị; các ảnh thông tin, banner tính năng và ảnh động GIF chèn vào phần thân bài viết.'
    )
  );

  // Warnings
  if (allWarnings.length > 0) {
    docChildren.push(
      new Paragraph({
        spacing: { before: 120, after: 60 },
        children: [
          new TextRun({
            text: 'Cảnh báo cần lưu ý:',
            font: 'Arial',
            size: 20,
            bold: true,
            color: 'DC2626',
          }),
        ],
      })
    );
    for (const w of allWarnings) {
      docChildren.push(createBulletPoint(w, 'DC2626'));
    }
  } else {
    docChildren.push(
      createBulletPoint('Cảnh báo kiểm tra: Thư mục đạt chuẩn, không phát hiện model lạ hay bất thường.')
    );
  }

  // Spec Check Results
  if (specCheck && specCheck.bang_thong_so && specCheck.bang_thong_so.length > 0) {
    docChildren.push(
      new Paragraph({
        spacing: { before: 140, after: 80 },
        children: [
          new TextRun({
            text: `Kết quả đối chiếu thông số với nhà sản xuất (Nguồn: ${specCheck.ten_nguon || specCheck.nguon_url || 'Website hãng'}):`,
            font: 'Arial',
            size: 20,
            bold: true,
            color: '1E3A8A',
          }),
        ],
      })
    );

    for (const spec of specCheck.bang_thong_so) {
      const statusText = spec.trang_thai === 'khop' ? '✓ Khớp' : spec.trang_thai === 'lech' ? '⚠ Lệch' : '? Chưa tìm thấy';
      docChildren.push(
        createBulletPoint(
          `${spec.thong_so}: [Trong ảnh] ${spec.trong_anh || 'N/A'} | [Theo hãng] ${spec.theo_hang || 'N/A'} (${statusText}${spec.ghi_chu ? ` - ${spec.ghi_chu}` : ''})`
        )
      );
    }
  }

  // Sales notes
  if (specCheck && specCheck.ghi_chu_ban_hang && specCheck.ghi_chu_ban_hang.length > 0) {
    docChildren.push(
      new Paragraph({
        spacing: { before: 140, after: 60 },
        children: [
          new TextRun({
            text: 'Đề xuất ghi chú bán hàng:',
            font: 'Arial',
            size: 20,
            bold: true,
            color: '059669', // Dark Green
          }),
        ],
      })
    );
    for (const note of specCheck.ghi_chu_ban_hang) {
      docChildren.push(createBulletPoint(note, '047857'));
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            size: 20, // 10pt
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

function itIsStatic(item: MediaItem): boolean {
  return Boolean(item.isShortStaticVideo);
}

function createHeading(text: string) {
  return new Paragraph({
    spacing: { before: 180, after: 80 },
    children: [
      new TextRun({
        text,
        font: 'Arial',
        size: 22, // 11pt
        bold: true,
        color: '1E3A8A',
      }),
    ],
  });
}

function createInfoLine(label: string, value: string) {
  return new Paragraph({
    spacing: { before: 30, after: 30 },
    children: [
      new TextRun({
        text: `• ${label} `,
        font: 'Arial',
        size: 20,
        bold: true,
        color: '374151',
      }),
      new TextRun({
        text: value || '—',
        font: 'Arial',
        size: 20,
        color: '111827',
      }),
    ],
  });
}

function createBulletPoint(text: string, color = '374151') {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({
        text: `• ${text}`,
        font: 'Arial',
        size: 20,
        color,
      }),
    ],
  });
}
