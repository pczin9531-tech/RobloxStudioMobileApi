// ═══════════════════════════════════════════════════════════
// 🚀 SERVIDOR RENDER - ROBLOX STUDIO MOBILE
// ═══════════════════════════════════════════════════════════
// Este servidor recebe os dados do jogo e publica no Roblox
// usando a API Key do usuário (temporária, não salva)

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 10000;

// ═══════════════════════════════════════════════════════════
// ⚙️ CONFIGURAÇÕES
// ═══════════════════════════════════════════════════════════

app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Rate limiting para evitar abuso
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 50 // Máximo 50 requests por IP a cada 15 minutos
});
app.use('/api/', limiter);

// ═══════════════════════════════════════════════════════════
// 📦 FUNÇÃO PARA CONVERTER JSON EM RBXM
// ═══════════════════════════════════════════════════════════

function convertToRBXM(workspaceData) {
    // Esta é uma simplificação. Idealmente você usaria uma biblioteca
    // para converter JSON em formato RBXM/RBXL
    // Por enquanto, vamos enviar como um ModelData XML básico
    
    const data = JSON.parse(workspaceData);
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<roblox version="4">
<Meta name="ExternalSourceAssetFormat" value="Binary"/>
<Item class="Model" referent="ROOT">
    <Properties>
        <string name="Name">ImportedWorkspace</string>
    </Properties>
    <Item class="Folder" referent="ITEMS">
        <Properties>
            <string name="Name">Objects</string>
        </Properties>`;
    
    // Adicionar objetos (simplificado)
    data.Objects.forEach((obj, index) => {
        xml += `
        <Item class="${obj.ClassName}" referent="OBJ${index}">
            <Properties>
                <string name="Name">${obj.Name}</string>
            </Properties>
        </Item>`;
    });
    
    xml += `
    </Item>
</Item>
</roblox>`;
    
    return xml;
}

// ═══════════════════════════════════════════════════════════
// 🌐 ROTAS DA API
// ═══════════════════════════════════════════════════════════

// Rota de teste
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Roblox Studio Mobile API',
        version: '1.0.0',
        endpoints: {
            publish: '/api/v1/publish',
            health: '/health'
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════
// 🚀 ROTA PRINCIPAL - PUBLISH/CREATE PLACE
// ═══════════════════════════════════════════════════════════

app.post('/api/v1/publish', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { action, placeId, workspaceData, userId, userName } = req.body;
        const apiKey = req.headers['x-api-key'];
        
        // Validações
        if (!apiKey || apiKey.length < 20) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or missing API Key'
            });
        }
        
        if (!action || (action !== 'publish' && action !== 'create')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid action. Must be "publish" or "create"'
            });
        }
        
        if (!workspaceData) {
            return res.status(400).json({
                success: false,
                error: 'Missing workspace data'
            });
        }
        
        if (action === 'publish' && !placeId) {
            return res.status(400).json({
                success: false,
                error: 'Place ID required for publish action'
            });
        }
        
        console.log(`📨 Request from ${userName} (${userId})`);
        console.log(`🎯 Action: ${action}${placeId ? ` | Place ID: ${placeId}` : ''}`);
        
        // ═══════════════════════════════════════════════════════════
        // 🔄 OPÇÃO 1: ATUALIZAR PLACE EXISTENTE
        // ═══════════════════════════════════════════════════════════
        
        if (action === 'publish') {
            console.log('🔄 Updating existing place...');
            
            // Converter workspace para RBXL/RBXM
            const rbxmData = convertToRBXM(workspaceData);
            
            // Atualizar usando Roblox Open Cloud API
            // https://create.roblox.com/docs/cloud/reference/Place
            
            const updateResponse = await axios.post(
                `https://apis.roblox.com/universes/v1/${placeId}/places/${placeId}/versions?versionType=Published`,
                rbxmData,
                {
                    headers: {
                        'x-api-key': apiKey,
                        'Content-Type': 'application/xml'
                    },
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                }
            );
            
            const processingTime = Date.now() - startTime;
            
            console.log(`✅ Place updated successfully in ${processingTime}ms`);
            
            return res.json({
                success: true,
                action: 'publish',
                placeId: placeId,
                placeUrl: `https://www.roblox.com/games/${placeId}`,
                versionNumber: updateResponse.data.versionNumber || 'latest',
                processingTime: `${processingTime}ms`,
                message: 'Place updated successfully!'
            });
        }
        
        // ═══════════════════════════════════════════════════════════
        // ✨ OPÇÃO 2: CRIAR NOVA PLACE
        // ═══════════════════════════════════════════════════════════
        
        if (action === 'create') {
            console.log('✨ Creating new place...');
            
            // Passo 1: Criar um novo Universe (Game)
            const createUniverseResponse = await axios.post(
                'https://apis.roblox.com/universes/v1/universes',
                {
                    displayName: `Studio Mobile - ${new Date().toLocaleDateString()}`,
                    description: 'Created with Roblox Studio Mobile',
                    genre: 'All',
                    isForSale: false,
                    price: 0
                },
                {
                    headers: {
                        'x-api-key': apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            const universeId = createUniverseResponse.data.id;
            const rootPlaceId = createUniverseResponse.data.rootPlaceId;
            
            console.log(`🆕 Universe created: ${universeId}`);
            console.log(`🏠 Root Place ID: ${rootPlaceId}`);
            
            // Passo 2: Fazer upload do conteúdo para a place
            const rbxmData = convertToRBXM(workspaceData);
            
            await axios.post(
                `https://apis.roblox.com/universes/v1/${universeId}/places/${rootPlaceId}/versions?versionType=Published`,
                rbxmData,
                {
                    headers: {
                        'x-api-key': apiKey,
                        'Content-Type': 'application/xml'
                    },
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                }
            );
            
            const processingTime = Date.now() - startTime;
            
            console.log(`✅ New place created successfully in ${processingTime}ms`);
            
            return res.json({
                success: true,
                action: 'create',
                universeId: universeId,
                placeId: rootPlaceId,
                placeUrl: `https://www.roblox.com/games/${rootPlaceId}`,
                editUrl: `https://create.roblox.com/dashboard/creations/experiences/${universeId}/overview`,
                processingTime: `${processingTime}ms`,
                message: 'New place created successfully!'
            });
        }
        
    } catch (error) {
        console.error('❌ Error processing request:', error.message);
        
        // Tratamento de erros da API do Roblox
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;
            
            console.error('Roblox API Error:', {
                status,
                data
            });
            
            // Erros comuns
            if (status === 401 || status === 403) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid API Key or insufficient permissions',
                    details: 'Make sure your API Key has the required scopes: universe.place:write'
                });
            }
            
            if (status === 404) {
                return res.status(404).json({
                    success: false,
                    error: 'Place not found',
                    details: 'The Place ID provided does not exist or you do not have access to it'
                });
            }
            
            if (status === 429) {
                return res.status(429).json({
                    success: false,
                    error: 'Rate limit exceeded',
                    details: 'Too many requests. Please wait a moment and try again'
                });
            }
            
            return res.status(status).json({
                success: false,
                error: 'Roblox API error',
                details: data.message || data.error || 'Unknown error'
            });
        }
        
        // Erro de conexão ou outro erro
        return res.status(500).json({
            success: false,
            error: 'Server error',
            details: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════
// 📋 ROTA PARA LISTAR PLACES DO USUÁRIO (OPCIONAL)
// ═══════════════════════════════════════════════════════════

app.get('/api/v1/places', async (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'];
        
        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'API Key required'
            });
        }
        
        // Listar universos do usuário
        const response = await axios.get(
            'https://apis.roblox.com/universes/v1/universes',
            {
                headers: {
                    'x-api-key': apiKey
                },
                params: {
                    limit: 50
                }
            }
        );
        
        const places = response.data.data.map(universe => ({
            universeId: universe.id,
            placeId: universe.rootPlaceId,
            name: universe.displayName,
            description: universe.description,
            url: `https://www.roblox.com/games/${universe.rootPlaceId}`
        }));
        
        return res.json({
            success: true,
            places: places
        });
        
    } catch (error) {
        console.error('Error listing places:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════
// 🎯 TRATAMENTO DE ERROS 404
// ═══════════════════════════════════════════════════════════

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        availableEndpoints: {
            publish: 'POST /api/v1/publish',
            listPlaces: 'GET /api/v1/places',
            health: 'GET /health'
        }
    });
});

// ═══════════════════════════════════════════════════════════
// 🚀 INICIAR SERVIDOR
// ═══════════════════════════════════════════════════════════

app.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 Roblox Studio Mobile API Server');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`📋 API endpoint: http://localhost:${PORT}/api/v1/publish`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Ready to receive requests!');
});
