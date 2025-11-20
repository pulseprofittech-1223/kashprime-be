const {supabase} = require("../services/supabase.service");
const { validationResult } = require("express-validator");
const crypto = require("crypto");
const { getPackagePrice, formatPrice } = require("../utils/packagePrices");

// Generate package codes for merchants (Admin only)
const generateCodes = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        message: "Validation error",
        data: { errors: errors.array() },
      });
    }

    const { merchantUsername, packageType, quantity } = req.body;
    const adminId = req.user.id;

    // Verify admin role
    if (req.user.role !== "admin") {
      return res.status(403).json({
        status: "error",
        message: "Unauthorized. Admin access required.",
      });
    }

    // Validate quantity limit
    if (quantity > 50) {
      return res.status(400).json({
        status: "error",
        message: "Maximum 50 codes can be generated at once",
      });
    }

    // Verify merchant exists
    const { data: merchant, error: merchantError } = await supabase
      .from("users")
      .select("id, username, role, full_name")
      .eq("username", merchantUsername)
      .eq("role", "merchant")
      .single();

    if (merchantError || !merchant) {
      return res.status(404).json({
        status: "error",
        message: "Merchant not found or invalid role",
      });
    }

    // Get package price
    const packagePrice = getPackagePrice(packageType);
    if (!packagePrice) {
      return res.status(400).json({
        status: "error",
        message: "Invalid package type",
      });
    }

    // Generate codes
    const codes = [];
    const usernamePrefix = merchant.username.slice(-4).toUpperCase();

    for (let i = 0; i < quantity; i++) {
      const randomCode = crypto.randomBytes(6).toString("hex").toUpperCase();
      const packageCode = `${usernamePrefix}${randomCode}`;

      codes.push({
        code: packageCode,
        package_type: packageType,
        price: packagePrice,
        is_used: false,
        used_by: null,
        created_by: adminId,
        merchant_id: merchant.id,  
        created_at: new Date().toISOString(),
      });
    }

    // Insert codes into database
    const { error: insertError } = await supabase
      .from("package_codes")
      .insert(codes);

    if (insertError) {
      console.error("Error inserting codes:", insertError);
      return res.status(500).json({
        status: "error",
        message: "Failed to generate codes",
      });
    }

    // Log code generation activity
    await supabase.from("admin_activities").insert({
      admin_id: adminId,
      activity_type: "codes_generated",
      description: `Generated ${quantity} ${packageType} codes for merchant ${merchant.username}`,
      metadata: {
        merchant_id: merchant.id,
        merchant_username: merchant.username,
        package_type: packageType,
        quantity: quantity,
        total_value: packagePrice * quantity,
      },
      created_at: new Date().toISOString(),
    });

    res.status(201).json({
      status: "success",
      message: `${quantity} ${packageType} codes generated successfully`,
      data: {
        codesGenerated: quantity,
        packageType,
        packagePrice: formatPrice(packagePrice),
        totalValue: formatPrice(packagePrice * quantity),
        merchant: {
          id: merchant.id,
          username: merchant.username,
          fullName: merchant.full_name
        },
        codes: codes.map((code) => ({
          code: code.code,
          price: formatPrice(packagePrice),
          merchantUsername: merchant.username
        })),
      },
    });
  } catch (error) {
    console.error("Generate codes error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

// Validate package code (Public endpoint)  
const validateCode = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        message: "Validation error",
        data: { errors: errors.array() },
      });
    }

    const { code } = req.body;

    const { data: packageCode, error } = await supabase
      .from("package_codes")
      .select(`
        id,
        code,
        package_type,
        price,
        is_used,
        used_by,
        created_at,
        used_at,
        users!package_codes_used_by_fkey(
          id,
          username, 
          full_name,
          email,
          referred_by,
          referrer:referred_by(
            id,
            username,
            full_name,
            email
          )
        ),
        merchant:users!package_codes_merchant_id_fkey(id, username, full_name)
      `)
      .eq("code", code.toUpperCase())
      .single();

    if (error || !packageCode) {
      return res.status(404).json({
        status: "error",
        message: "Package code does not exist",
      });
    }

    if (packageCode.is_used) {
      const userWhoUsedCode = packageCode.users;
      const referrerInfo = userWhoUsedCode?.referrer;
      
      return res.status(400).json({
        status: "error",
        message: `Package code has already been used by ${userWhoUsedCode?.username || "Unknown"}${referrerInfo ? ` (referred by ${referrerInfo.username})` : ' (no referrer)'}`,
        data: {
          codeUsage: {
            usedBy: {
              username: userWhoUsedCode?.username || "Unknown",
              fullName: userWhoUsedCode?.full_name || "Unknown",
              email: userWhoUsedCode?.email || "Unknown"
            },
            referredBy: referrerInfo ? {
              username: referrerInfo.username || "Unknown",
              fullName: referrerInfo.full_name || "Unknown",
              email: referrerInfo.email || "Unknown"
            } : null,
            usedAt: packageCode.used_at,
            registrationChain: referrerInfo 
              ? `${userWhoUsedCode.username} was referred by ${referrerInfo.username}`
              : `${userWhoUsedCode.username} registered without a referrer`
          },
          packageInfo: {
            packageType: packageCode.package_type,
            price: formatPrice(packageCode.price),
            merchant: {
              username: packageCode.merchant?.username || "Unknown",
              fullName: packageCode.merchant?.full_name || "Unknown"
            }
          }
        },
      });
    }

    res.json({
      status: "success",
      message: "Package code is valid and available for use",
      data: {
        code: packageCode.code,
        packageType: packageCode.package_type,
        price: formatPrice(packageCode.price),
        merchant: {
          username: packageCode.merchant?.username || "Unknown",
          fullName: packageCode.merchant?.full_name || "Unknown"
        },
        isValid: true,
        isAvailable: true
      },
    });
  } catch (error) {
    console.error("Validate code error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

// Get merchant's own codes (Merchant only) 
const getMerchantCodes = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, packageType } = req.query;
    const offset = (page - 1) * limit;

    // Build base query for counting
    let countQuery = supabase
      .from("package_codes")
      .select("*", { count: "exact", head: true })
      .eq("merchant_id", req.user.id);

    // Build main query for data
    let dataQuery = supabase
      .from("package_codes")
      .select(`
        id,
        code,
        package_type,
        price,
        is_used,
        created_at,
        used_at,
        users!package_codes_used_by_fkey(username, full_name)
      `)
      .eq("merchant_id", req.user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    // Apply filters to both queries
    if (status === "used") {
      countQuery = countQuery.eq("is_used", true);
      dataQuery = dataQuery.eq("is_used", true);
    } else if (status === "unused") {
      countQuery = countQuery.eq("is_used", false);
      dataQuery = dataQuery.eq("is_used", false);
    }

    if (packageType && ["Amateur", "Pro"].includes(packageType)) {
      countQuery = countQuery.eq("package_type", packageType);
      dataQuery = dataQuery.eq("package_type", packageType);
    }

    // Execute both queries
    const [{ count }, { data: codes, error }] = await Promise.all([
      countQuery,
      dataQuery
    ]);

    if (error) {
      console.error("Error fetching merchant codes:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch codes",
      });
    }

    // Get total counts and revenue for this specific merchant
    const { data: totalStats, error: statsError } = await supabase.rpc(
      "get_merchant_total_stats_with_revenue",
      {
        merchant_id: req.user.id,
      }
    );

    if (statsError) {
      console.error("Error fetching stats:", statsError);
      // Continue without breaking, but log the error
    }

    // Format codes with price display
    const formattedCodes = codes.map((code) => ({
      ...code,
      price: formatPrice(code.price),
      usedBy: code.users?.username || null,
    }));

    // Calculate pagination
    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    // Extract stats with fallbacks
    const stats = totalStats && totalStats.length > 0 ? totalStats[0] : null;

    res.json({
      status: "success",
      message: "Codes retrieved successfully",
      data: {
        codes: formattedCodes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: totalPages,
        },
        statistics: {
          total_codes: stats?.total_codes || 0,
          used_codes: stats?.used_codes || 0,
          unused_codes: stats?.unused_codes || 0,
          total_revenue: formatPrice(stats?.total_revenue || 0),
          amateur_revenue: formatPrice(stats?.amateur_revenue || 0),
          pro_revenue: formatPrice(stats?.pro_revenue || 0),
        },
      },
    });
  } catch (error) {
    console.error("Get merchant codes error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

// Get codes statistics by merchant (Admin only)  
const getCodesStatistics = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        status: "error",
        message: "Unauthorized. Admin access required.",
      });
    }

   
    const { data: statistics, error } = await supabase.rpc(
      "get_merchant_code_stats"
    );

    if (error) {
      console.error("Error fetching statistics:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch statistics",
      });
    }

    // Format the statistics
    const formattedStats = statistics.map((stat) => ({
      ...stat,
      total_revenue: formatPrice(stat.total_revenue || 0),
      amateur_revenue: formatPrice(stat.amateur_revenue || 0),
      pro_revenue: formatPrice(stat.pro_revenue || 0),
    }));

    res.json({
      status: "success",
      message: "Code statistics retrieved successfully",
      data: { statistics: formattedStats },
    });
  } catch (error) {
    console.error("Get statistics error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

// Bulk delete unused codes (Admin only)  
const bulkDeleteUnusedCodes = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        status: "error",
        message: "Unauthorized. Admin access required.",
      });
    }

    const { merchantId, packageType } = req.body;

    let query = supabase.from("package_codes").delete().eq("is_used", false);

    if (merchantId) {
      query = query.eq("merchant_id", merchantId);  
    }

    if (packageType) {
      query = query.eq("package_type", packageType);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error deleting codes:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to delete codes",
      });
    }

    res.json({
      status: "success",
      message: "Unused codes deleted successfully",
      data: { deletedCount: data?.length || 0 },
    });
  } catch (error) {
    console.error("Bulk delete codes error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

// Get package prices (Public endpoint)
const getPackagePrices = async (req, res) => {
  try {
    const { getAllPackages } = require("../utils/packagePrices");

    res.json({
      status: "success",
      message: "Package prices retrieved successfully",
      data: {
        packages: getAllPackages(),
      },
    });
  } catch (error) {
    console.error("Get package prices error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};


// Get all merchants (Public only)
const getMerchants = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('users')
      .select(`
        id,
        username,
        email,
        full_name,
        phone_number,
        created_at,
        account_status
      `, { count: 'exact' })
      .eq('role', 'merchant');

    // Add search functionality
    if (search) {
      query = query.or(`username.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: allMerchants, error, count } = await query;
    if (error) throw error;

    // Shuffle the merchants array for random order
    const shuffledMerchants = allMerchants ? [...allMerchants].sort(() => Math.random() - 0.5) : [];
    
    // Apply pagination after shuffling
    const paginatedMerchants = shuffledMerchants.slice(offset, offset + parseInt(limit));

    // Get code statistics for each merchant
    const merchantsWithStats = await Promise.all(
      paginatedMerchants.map(async (merchant) => {
        const { data: codes } = await supabase
          .from('package_codes')
          .select('is_used, package_type')
          .eq('merchant_id', merchant.id);

        const totalCodes = codes?.length || 0;
        const usedCodes = codes?.filter(c => c.is_used).length || 0;
        const unusedCodes = totalCodes - usedCodes;

        return {
          ...merchant,
          code_stats: {
            total_codes: totalCodes,
            used_codes: usedCodes,
            unused_codes: unusedCodes,
            amateur_codes: codes?.filter(c => c.package_type === 'Amateur').length || 0,
            pro_codes: codes?.filter(c => c.package_type === 'Pro').length || 0
          }
        };
      })
    );

    res.status(200).json({
      status: 'success',
      message: 'Merchants retrieved successfully',
      data: {
        merchants: merchantsWithStats,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil((count || 0) / limit),
          total_merchants: count || 0,
          has_next: offset + limit < (count || 0),
          has_prev: page > 1,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get merchants error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};


// Delete package codes (Admin only)
const deleteCodes = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        message: "Validation error",
        data: { errors: errors.array() },
      });
    }

    const { merchantUsername, packageType, quantity } = req.body;
    const adminId = req.user.id;

    // Verify admin role
    if (req.user.role !== "admin") {
      return res.status(403).json({
        status: "error",
        message: "Unauthorized. Admin access required.",
      });
    }

    // Verify merchant exists
    const { data: merchant, error: merchantError } = await supabase
      .from("users")
      .select("id, username, role, full_name")
      .eq("username", merchantUsername)
      .eq("role", "merchant")
      .single();

    if (merchantError || !merchant) {
      return res.status(404).json({
        status: "error",
        message: "Merchant not found or invalid role",
      });
    }

    // First, get the codes to be deleted (for logging and response)
    let query = supabase
      .from("package_codes")
      .select("id, code, package_type, price")
      .eq("merchant_id", merchant.id)
      .eq("is_used", false); // Only delete unused codes

    if (packageType) {
      query = query.eq("package_type", packageType);
    }

    if (quantity) {
      query = query.limit(quantity);
    }

    const { data: codesToDelete, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching codes:", fetchError);
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch codes for deletion",
      });
    }

    if (!codesToDelete || codesToDelete.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No unused codes found for the specified criteria",
      });
    }

    // Extract the IDs of codes to delete
    const codeIds = codesToDelete.map(code => code.id);

    // Delete the codes
    const { error: deleteError } = await supabase
      .from("package_codes")
      .delete()
      .in("id", codeIds);

    if (deleteError) {
      console.error("Error deleting codes:", deleteError);
      return res.status(500).json({
        status: "error",
        message: "Failed to delete codes",
      });
    }

    // Calculate total value of deleted codes
    const totalValue = codesToDelete.reduce((sum, code) => sum + parseFloat(code.price), 0);

    // Log code deletion activity
    await supabase.from("admin_activities").insert({
      admin_id: adminId,
      activity_type: "codes_deleted",
      description: `Deleted ${codesToDelete.length} codes for merchant ${merchant.username}`,
      metadata: {
        merchant_id: merchant.id,
        merchant_username: merchant.username,
        package_type: packageType || "mixed",
        quantity: codesToDelete.length,
        total_value: totalValue,
        deleted_codes: codesToDelete.map(code => ({
          code: code.code,
          package_type: code.package_type,
          price: code.price
        }))
      },
      created_at: new Date().toISOString(),
    });

    res.status(200).json({
      status: "success",
      message: `${codesToDelete.length} codes deleted successfully`,
      data: {
        codesDeleted: codesToDelete.length,
        totalValue: formatPrice(totalValue),
        merchant: {
          id: merchant.id,
          username: merchant.username,
          fullName: merchant.full_name
        },
        deletedCodes: codesToDelete.map((code) => ({
          code: code.code,
          packageType: code.package_type,
          price: formatPrice(code.price)
        })),
      },
    });
  } catch (error) {
    console.error("Delete codes error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};




module.exports = {
  generateCodes,
  getMerchants,
  getCodesStatistics,
  validateCode,
  getMerchantCodes,
  getPackagePrices,
  bulkDeleteUnusedCodes,deleteCodes, 
};
