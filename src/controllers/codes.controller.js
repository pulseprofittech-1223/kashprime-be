const { supabaseAdmin } = require('../services/supabase.service');
const crypto = require('crypto');

const generateCode = () => {
    return crypto.randomBytes(8).toString('hex').toUpperCase(); // 16 alphanumeric digits
};

// @desc    Generate deposit codes
// @route   POST /api/codes/generate
// @access  Admin
exports.generateCodes = async (req, res) => {
    try {
        const { amount, merchant_id, count } = req.body;
        
        if (![3000, 5000, 10000, 20000, 50000].includes(Number(amount))) {
            return res.status(400).json({ success: false, error: 'Invalid denomination' });
        }
        
        if (!merchant_id) {
            return res.status(400).json({ success: false, error: 'Merchant ID is required' });
        }

        const codesToInsert = [];
        for (let i = 0; i < (count || 1); i++) {
            codesToInsert.push({
                code: generateCode(),
                amount: Number(amount),
                merchant_id,
                created_by: req.user.id,
                status: 'active'
            });
        }

        const { data, error } = await supabaseAdmin
            .from('deposit_codes')
            .insert(codesToInsert)
            .select('*');

        if (error) throw error;
        
        // Log activity
        await supabaseAdmin.from('admin_activities').insert({
            admin_id: req.user.id,
            activity_type: 'generate_codes',
            description: `Generated ${count || 1} codes worth ${amount} for merchant ${merchant_id}`,
            metadata: { count: count || 1, amount }
        });

        res.status(201).json({ success: true, data });
    } catch (error) {
        console.error('Generate codes error:', error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

// @desc    Get all deposit codes
// @route   GET /api/codes
// @access  Admin or Merchant
exports.getCodes = async (req, res) => {
    try {
        let query = supabaseAdmin
            .from('deposit_codes')
            .select(`
                *,
                merchant:users!merchant_id (id, full_name, username),
                user:users!used_by (id, full_name, username)
            `)
            .order('created_at', { ascending: false });

        // If not admin, only show codes assigned to this user
        if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            query = query.eq('merchant_id', req.user.id);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Get codes error:', error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};

// @desc    Delete deposit codes (bulk)
// @route   DELETE /api/codes
// @access  Admin
exports.deleteCodes = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: 'An array of code IDs is required' });
        }

        // Only allow deletion of active (un-redeemed) codes
        const { data: toDelete, error: fetchError } = await supabaseAdmin
            .from('deposit_codes')
            .select('id, status, code')
            .in('id', ids);

        if (fetchError) throw fetchError;

        const redeemedCodes = toDelete.filter(c => c.status === 'used');
        if (redeemedCodes.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Cannot delete ${redeemedCodes.length} already-redeemed code(s). Only active codes can be deleted.`
            });
        }

        const { error: deleteError } = await supabaseAdmin
            .from('deposit_codes')
            .delete()
            .in('id', ids);

        if (deleteError) throw deleteError;

        // Log activity
        await supabaseAdmin.from('admin_activities').insert({
            admin_id: req.user.id,
            activity_type: 'delete_codes',
            description: `Deleted ${ids.length} deposit code(s)`,
            metadata: { deleted_count: ids.length, ids }
        });

        res.status(200).json({ success: true, message: `${ids.length} code(s) deleted successfully` });
    } catch (error) {
        console.error('Delete codes error:', error);
        res.status(500).json({ success: false, error: error.message || 'Server error' });
    }
};
