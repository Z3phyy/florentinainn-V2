export async function stripeBooking(
    amountInput: string,
    bookingId: string
) {
  const amount = parseInt(amountInput, 10) * 100;

  //4242 4242 4242 4242 

  if (amount < 2000) {
    alert("Invalid Amount - The minimum is ₱20");
    return;
  }

  const referenceId = `${Date.now()}`;

  try {
    const response = await fetch('/api/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        bookingId,
        referenceId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('API Error:', data);
      alert(`Failed: ${data.error || 'Unknown error'}`);
      return;
    }

    // ✅ Direct redirect - no Stripe.js needed
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      alert('Failed to get checkout URL');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Something went wrong.');
  }
}

