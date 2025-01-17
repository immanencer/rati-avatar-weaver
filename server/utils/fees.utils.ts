import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";

export async function calculateOptimalFees(connection: Connection) {
  try {
    // Ensure connection is properly initialized
    if (!connection) {
      throw new Error('Connection object is required for fee calculation');
    }

    const priorityFees = await connection.getRecentPrioritizationFees();
    if (!priorityFees.length) {
      return {
        computeUnitPrice: 5_000_000, // Increased base fee
        computeUnits: 1_400_000,
        totalPriorityFeeLamports: 7_000_000,
        estimatedPriorityFee: 0.007,
      };
    }

    // Calculate fees based on recent transactions
    const recentFees = priorityFees
      .slice(0, 20)
      .sort((a, b) => b.prioritizationFee - a.prioritizationFee);
    const percentile95Index = Math.floor(recentFees.length * 0.95);
    const computeUnitPrice = Math.max(
      recentFees[percentile95Index].prioritizationFee * 3,
      5_000_000
    );
    const computeUnits = 1_400_000;
    const totalPriorityFeeLamports = Math.ceil(
      (computeUnitPrice * computeUnits) / 1_000_000
    );

    console.log('Calculated optimal fees:', {
      computeUnitPrice,
      computeUnits,
      totalPriorityFeeLamports,
      estimatedPriorityFee: totalPriorityFeeLamports / LAMPORTS_PER_SOL
    });

    return {
      computeUnitPrice,
      computeUnits,
      totalPriorityFeeLamports,
      estimatedPriorityFee: totalPriorityFeeLamports / LAMPORTS_PER_SOL,
    };
  } catch (error) {
    console.error('Error calculating optimal fees:', error);
    // Return higher default values to ensure transaction success
    return {
      computeUnitPrice: 5_000_000,
      computeUnits: 1_400_000,
      totalPriorityFeeLamports: 7_000_000,
      estimatedPriorityFee: 0.007,
    };
  }
}