const JSONBIN_ID = '6a1b306addf5aa59f77931ce';
const JSONBIN_KEY = '$2a$10$Zwb8odSEJRJ26YLeEjwg.uXOkPbPRyRvC.FE5tvWlvgrK38/2nf5.';
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || '';
const BASE_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_ID}`;

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  if (event.httpMethod === 'GET') {
    try {
      const res = await fetch(BASE_URL + '/latest', { headers: { 'X-Master-Key': JSONBIN_KEY } });
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data.record) };
    } catch(e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error leyendo datos' }) };
    }
  }

  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');

    if (body.action === 'scan') {
      try {
        const content = [];
        if (body.portada) {
          content.push({ type: 'image', source: { type: 'base64', media_type: body.portadaMime || 'image/jpeg', data: body.portada } });
          content.push({ type: 'text', text: 'Esta es la portada del libro.' });
        }
        if (body.derechos) {
          content.push({ type: 'image', source: { type: 'base64', media_type: body.derechosMime || 'image/jpeg', data: body.derechos } });
          content.push({ type: 'text', text: 'Esta es la página de derechos del libro.' });
        }
        content.push({ type: 'text', text: `Analiza las imágenes y extrae información del libro.
Responde SOLO con JSON válido, sin markdown ni texto adicional.
Campos:
- titulo: título del libro
- autor: "Apellido, Nombre"
- editorial: nombre de la editorial
- anio: año de publicación
- pais: país (USA, España, Brasil, UK, México, etc.)
- idioma: Español, Inglés, Portugués, u otro
- edicion: "Primera" si dice First Edition/Primera edición/1ª ed, "Reimpresión" si no hay 1 en number line, "Especial" si es edición especial
- impresion: "1ª" si number line tiene 1 o dice First Printing, "2ª–5ª" si número más bajo es 2-5, "6ª+" si es 6+, "N/D" si no hay info
- formato: "Tapa dura" o "Pasta blanda"
Si no puedes determinar un campo, usa "".` });

        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-opus-4-5', max_tokens: 1000, messages: [{ role: 'user', content }] })
        });
        const aiData = await aiRes.json();
        const text = aiData.content && aiData.content[0] ? aiData.content[0].text : '';
        const extracted = JSON.parse(text.replace(/```json|```/g,'').trim());
        return { statusCode: 200, headers, body: JSON.stringify(extracted) };
      } catch(e) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error en escaneo: ' + e.message }) };
      }
    }

    if (body.action === 'save') {
      try {
        await fetch(BASE_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_KEY },
          body: JSON.stringify(body.data)
        });
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      } catch(e) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error guardando datos' }) };
      }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Acción no reconocida' }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
};
