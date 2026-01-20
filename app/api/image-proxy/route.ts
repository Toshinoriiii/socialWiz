import { NextRequest, NextResponse } from 'next/server';

/**
 * 图片代理接口
 * 用于代理阿里云 OSS 图片，解决 Content-Disposition: attachment 导致无法预览的问题
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: '缺少图片 URL' }, { status: 400 });
  }

  try {
    // 获取原始图片
    const imageResponse = await fetch(imageUrl);
    
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: '无法获取图片' },
        { status: imageResponse.status }
      );
    }

    // 获取图片数据
    const imageBuffer = await imageResponse.arrayBuffer();
    
    // 从原始响应中获取 Content-Type
    const contentType = imageResponse.headers.get('content-type') || 'image/png';

    // 返回图片，设置正确的响应头
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // 缓存一年
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('图片代理错误:', error);
    return NextResponse.json(
      { error: '图片代理失败' },
      { status: 500 }
    );
  }
}
