/**
 * Export Download API Route
 * 
 * GET /api/exports/:exportId/download
 * 
 * Proxies download request to backend /exports/:id/download endpoint
 */

import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' 
  ? 'https://api.leadscope.gr'
  : 'http://localhost:3001')

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ exportId: string }> }
) {
  try {
    const { exportId } = await params

    if (!exportId) {
      return NextResponse.json(
        { error: 'Export ID is required' },
        { status: 400 }
      )
    }

    // Build backend URL
    const backendUrl = `${API_BASE_URL}/exports/${exportId}/download`

    // Forward request to backend with cookies for authentication
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[exports/download] Backend error:', response.status, errorText)
      
      // If export is still processing
      if (response.status === 202) {
        return NextResponse.json(
          {
            error: 'Export is still processing',
            status: 'processing',
            message: 'Please wait for the export to complete before downloading'
          },
          { status: 202 }
        )
      }

      return NextResponse.json(
        { error: `Download failed: ${errorText}` },
        { status: response.status }
      )
    }

    // Get the file blob from backend
    const blob = await response.blob()
    
    // Get content type and filename from response headers
    const contentType = response.headers.get('Content-Type') || 'application/octet-stream'
    const contentDisposition = response.headers.get('Content-Disposition') || `attachment; filename="export-${exportId}"`
    
    // Return the file with proper headers
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
      },
    })
  } catch (error: any) {
    console.error('[exports/download] Error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to download export',
      },
      { status: 500 }
    )
  }
}
