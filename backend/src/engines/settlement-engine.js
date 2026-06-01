function determineFinalStatus(highestBidderId) {
    if (highestBidderId && highestBidderId !== 0 && highestBidderId !== '0') {
        return 'SOLD';
    }
    return 'FAILED';
}

function settleAuction(auction, now) {
    const newState = { ...auction };
    const finalStatus = determineFinalStatus(auction.highest_bidder_id);
    
    newState.status = finalStatus;
    newState.final_price = finalStatus === 'SOLD' ? auction.current_price : null;

    if (!auction.actual_end_time) {
        newState.actual_end_time = now;
    }

    return newState;
}

module.exports = {
    determineFinalStatus,
    settleAuction
};