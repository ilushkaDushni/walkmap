"use client";

import { useEffect, useRef, useState } from "react";

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export default function CountUp({ end, duration = 1200, suffix = "" }) {
  const [value, setValue] = useState(0);
  const ref = useRef();

  useEffect(() => {
    if (end === 0) { setValue(0); return; }
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setValue(Math.round(easeOutCubic(progress) * end));
      if (progress < 1) {
        ref.current = requestAnimationFrame(step);
      }
    };
    ref.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(ref.current);
  }, [end, duration]);

  return <>{value.toLocaleString("ru-RU")}{suffix}</>;
}
