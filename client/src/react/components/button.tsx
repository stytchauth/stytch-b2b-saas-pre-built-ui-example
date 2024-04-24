import styles from "./button.module.css";

// @ts-ignore
const Button = ({
  children,
  type,
  href,
}: {
  children: string;
  type: string;
  href?: string;
}) => {
  // const logoImg = logo ? <img src={logo} alt={`${type} logo`} className={styles.logo} /> : null;
  const buttonContent = (
    <>
      {/* {logoImg} */}
      {children}
    </>
  );

  return href ? (
    <a href={href} className={`${styles.button} ${styles[type]}`}>
      {buttonContent}
    </a>
  ) : (
    <button className={`${styles.button} ${styles[type]}`}>
      {buttonContent}
    </button>
  );
};

export default Button;
