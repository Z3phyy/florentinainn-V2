export async function paymongoBooking(amountInput: string, bookingId: string) {
  const amount = parseInt(amountInput, 10) * 100;

  if (amount < 2000) {
    alert("Invalid Amount - The minimum is ₱20");
    return;
  }

  const referenceId = `${Date.now()}`;

  try {
    const response = await fetch("/api/paymongo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        bookingId,
        referenceId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("API Error:", data);
      alert(`Failed: ${data.error || "Unknown error"}`);
      return;
    }

    if (!data.checkoutUrl) {
      alert("Failed to get checkout URL");
      return;
    }

    if (data.sessionId) {
      try {
        sessionStorage.setItem(`paymongo_session_${bookingId}`, data.sessionId);
      } catch {}
    }

    // ✅ Direct redirect - no PayMongo.js needed
    window.location.href = data.checkoutUrl;
  } catch (error) {
    console.error("Error:", error);
    alert("Something went wrong.");
  }
}
