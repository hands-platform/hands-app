import http from 'node:http';

const targetPort = Number(process.env.TARGET_PORT ?? 3001);
const listenPort = Number(process.env.LISTEN_PORT ?? 3000);

http
  .createServer((request, response) => {
    if (request.url?.startsWith('/api/admin/services/health')) {
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          statusCode: 503,
          message: 'Service catalog health unavailable for QA',
        }),
      );
      return;
    }

    const proxyRequest = http.request(
      {
        host: '127.0.0.1',
        port: targetPort,
        path: request.url,
        method: request.method,
        headers: request.headers,
      },
      (proxyResponse) => {
        response.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
        proxyResponse.pipe(response);
      },
    );

    proxyRequest.on('error', () => {
      response.writeHead(502);
      response.end();
    });
    request.pipe(proxyRequest);
  })
  .listen(listenPort, '127.0.0.1');
