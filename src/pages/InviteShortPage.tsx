import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

export function InviteShortPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      navigate(`/invite?token=${token}`);
    } else {
      navigate("/");
    }
  }, [token, navigate]);

  return null; // Redirection immédiate
}
