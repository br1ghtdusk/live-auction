function determineFinalStatus(highestBidderId) {
    if (highestBidderId && highestBidderId !== 0 && highestBidderId !== '0') {
        return 'SOLD';
    }
    return 'FAILED';
}

function settleAuction(auction, now) {
    const newState = { ...auction };

    if (auction.highest_bidder_id && 
        auction.highest_bidder_id !== 0 && 
        auction.highest_bidder_id !== '0') {
        newState.status = 'SOLD';
        newState.final_price = auction.current_price;
    } else {
        newState.status = 'FAILED';
        newState.final_price = null;
    }

    if (!auction.actual_end_time) {
        newState.actual_end_time = now;
    }

    return newState;
}

module.exports = {
    determineFinalStatus,
    settleAuction
};